#!/usr/bin/env node
import fs from "fs"

import path from "path"

import cson from "cson"

import needle, { BodyData, NeedleOptions, NeedleResponse } from "needle"
import watch from "node-watch"
import validate from "is-my-json-valid"
import { argv } from "yargs"
import conf from "./configuration.schema"
import type { AsTyped } from "as-typed"
import { existsSync, realpathSync } from "node:fs"

type ConfType = Array<
	AsTyped<typeof conf>[number] & {
		scripts?: Record<string, string>
	}
>

const isConfValid = validate(conf as unknown as Parameters<typeof validate>[0]) as ((a: unknown) => a is ConfType) &
	ReturnType<typeof validate>

const defaultEndpoint = "https://phantombuster.com/api/v1"

function datePrefix() {
	return new Date().toLocaleTimeString() + " - "
}

function readFile(filename: string) {
	return new Promise<string>((resolve, reject) => {
		fs.readFile(filename, (err, value) => {
			if (err) {
				reject(err)
			} else {
				resolve(value.toString())
			}
		})
	})
}

function loadConfig(configPath: string) {
	const config = cson.load(configPath)
	if (isConfValid(config)) {
		for (const account of config) {
			if (account.apiKey.startsWith("ENV:")) {
				const envVar = account.apiKey.replace("ENV:", "")
				const envValue = process.env[envVar]
				if (typeof envValue !== "string" || account.apiKey.length < 10 || account.apiKey.length > 50) {
					console.log(`${account.name}: Environment variable "${envVar}" does not contain a valid API key`)
					process.exit(1)
				}
				account.apiKey = envValue
			}
		}
		return config
	} else {
		console.log(`${datePrefix()}${configPath} is not a correct SDK configuration file`)
		console.log(JSON.stringify(isConfValid.errors))
		process.exit(1)
	}
}

interface IAccount {
	name: string
	apiKey: string
	endpoint?: string
}

interface IScriptConfig {
	account: IAccount
	scriptPath: string
	scriptName: string
	realPath: string
}

class SdkContext {
	public readonly configurationFilePath: string
	private _workingDir: string
	public get workingDir() {
		return this._workingDir
	}
	private _configuration: ConfType
	public get configuration() {
		return this._configuration
	}

	constructor(configPath: string) {
		this.configurationFilePath = realpathSync(configPath)
		this._workingDir = path.dirname(this.configurationFilePath)
		this._configuration = loadConfig(this.configurationFilePath)
	}

	public getConfigsForScript(scriptPathToFind: string): IScriptConfig[] {
		let realPathToFind = null
		try {
			realPathToFind = realpathSync(scriptPathToFind).replace(extentionRegexp, "")
		} catch {
			return []
		}
		return this.configuration.reduce<IScriptConfig[]>((acc, item) => {
			const { scripts, ...account } = item
			if (!scripts) {
				return acc
			}
			return [
				...acc,
				...Object.entries(scripts)
					.filter(([, scriptPath]) => {
						const scriptAbsolutePath = realpathSync(path.join(this.workingDir, scriptPath)).replace(
							extentionRegexp,
							"",
						)
						return scriptAbsolutePath === realPathToFind
					})
					.map(([scriptName, scriptPath]) => ({
						account,
						scriptPath,
						scriptName,
						realPath: scriptPathToFind,
					})),
			]
		}, [])
	}
}

async function main() {
	const args = await argv
	const CONFIG_PATH = (args.c as string) || "phantombuster.cson"
	const ctx = new SdkContext(CONFIG_PATH)
	if (args._?.length) {
		for (const script of args._) {
			if (!(await updateScript(ctx, script as string))) {
				console.log(`${datePrefix()}${script}: Not found in configuration`)
			}
		}
	} else {
		const watchOptions = {
			recursive: true,
			filter: (f: string) => !/node_modules/.test(f),
		}
		watch(ctx.workingDir, watchOptions, async (event, updatedPath) => {
			if (event === "update") {
				if (updatedPath === ctx.configurationFilePath) {
					console.log(`${datePrefix()}${updatedPath}: Configuration reloaded`)
				} else {
					await updateScript(ctx, updatedPath)
				}
			}
		})
	}
}
async function uploadJson({ account, realPath }: IScriptConfig): Promise<string> {
	const jsonFile = realPath
	if (existsSync(jsonFile)) {
		try {
			const jsonText = await readFile(jsonFile)
			try {
				JSON.parse(jsonText)
				return jsonText
			} catch (jsonErr) {
				console.log(datePrefix() + account.name + ": [API store settings] " + jsonFile + ": " + jsonErr)
			}
		} catch (err) {
			if (!(err && typeof err === "object") || !("code" in err) || err.code !== "ENOENT") {
				console.log(`${datePrefix()}${account.name}: [API store settings] ${realPath}: ${err}`)
			}
		}
	}
	return ""
}

async function uploadMdFile({ account, realPath }: IScriptConfig): Promise<string> {
	const mdFile = realPath
	// console.error("md", mdFile)
	if (existsSync(mdFile)) {
		try {
			return await readFile(mdFile)
		} catch (err) {
			if (!(err && typeof err === "object") || !("code" in err) || err.code !== "ENOENT") {
				console.log(`${datePrefix()}${account.name}: [API store settings] ${realPath}: ${err}`)
			}
		}
	}
	return ""
}

const extentionRegexp = /.[^.]+$/
async function uploadScriptInfo(script: IScriptConfig) {
	const { account, scriptName, scriptPath, realPath } = script

	const jsonText = await uploadJson({ ...script, realPath: realPath.replace(extentionRegexp, ".json") })
	const mdText = await uploadMdFile({ ...script, realPath: realPath.replace(extentionRegexp, ".md") })

	const options = {
		json: true,
		headers: {
			"X-Phantombuster-Key-1": account.apiKey,
		},
	}
	const payload = {
		infoString: jsonText,
		markdown: mdText,
	}

	try {
		const response = await request<{ status: string; message?: string }>(
			`${account.endpoint || defaultEndpoint}/store-info/by-name/${scriptName}`,
			payload,
			options,
		)
		if (response.body?.status === "success") {
			console.log(`${datePrefix()}${account.name}: [API store settings] ${scriptPath} -> ${scriptName}`)
		} else {
			console.log(
				`${datePrefix()}${account.name}: [API store settings] ${scriptPath}: ${response.body?.status ?? "Error"}: ${response.body?.message ?? "HTTP " + response.statusCode}`,
			)
		}
	} catch (err) {
		console.log(`${datePrefix()}${account.name}: [API store settings] ${scriptPath}: ${err}`)
	}
}
function request<T>(url: string, body: BodyData, options?: NeedleOptions) {
	return new Promise<NeedleResponse & { body?: T }>((resolve, reject) =>
		needle.post(url, body, options, (error, response) => {
			if (error) {
				reject(error)
			} else {
				resolve(response)
			}
		}),
	)
}

async function uploadScript({ account, realPath, scriptName, scriptPath }: IScriptConfig) {
	try {
		const text = await readFile(realPath)
		const options = {
			json: true,
			headers: {
				"X-Phantombuster-Key-1": account.apiKey,
			},
		}
		const payload = {
			text: text.toString(),
			source: "sdk",
		}
		try {
			const res = await request<{ status: string; message?: string }>(
				`${account.endpoint || defaultEndpoint}/script/${scriptName}`,
				payload,
				options,
			)
			if (res.body?.status === "success") {
				console.log(
					`${datePrefix()}${account.name}: ${scriptPath} -> ${scriptName}${typeof res.body.data === "number" ? " (new script created)" : ""}`,
				)
			} else {
				console.log(
					`${datePrefix()}${account.name}: ${scriptPath}: ${res.body?.status ?? "Error"}: ${res.body?.message ?? "HTTP " + res.statusCode}`,
				)
			}
		} catch (err) {
			console.log(`${datePrefix()}${account.name}: ${scriptPath}: ${err}`)
		}
	} catch (err) {
		console.log(`${datePrefix()}${account.name}: ${scriptPath}: ${err}`)
	}
}

async function updateScript(ctx: SdkContext, updatedPath: string) {
	const configs = ctx.getConfigsForScript(updatedPath)
	if (configs.length === 0) {
		return false
	}
	for (const conf of configs) {
		if (updatedPath.endsWith(".json") || updatedPath.endsWith(".md")) {
			await uploadScriptInfo(conf)
		} else {
			await uploadScript(conf)
		}
	}
	return true
}

main().catch((error) => {
	console.log(error.toString())
	process.exit(1)
})
