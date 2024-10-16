import path from "path"

import cson from "cson"
import { realpathSync } from "node:fs"
import validate from "is-my-json-valid"

import { InvalidEnvVarError, WrongConfigFileError } from "./errors"
import conf from "./configuration.schema"
import type { ConfType, IScriptConfig } from "./types"
import { extentionRegexp } from "./constants"
import { uploadScriptInfo, uploadScript } from "./fileUpload"

const isConfValid = validate(conf as unknown as Parameters<typeof validate>[0]) as ((a: unknown) => a is ConfType) &
	ReturnType<typeof validate>

function loadConfig(configPath: string) {
	const config = cson.load(configPath)
	if (isConfValid(config)) {
		for (const account of config) {
			if (account.apiKey.startsWith("ENV:")) {
				const envVar = account.apiKey.replace("ENV:", "")
				const envValue = process.env[envVar]
				if (typeof envValue !== "string" || account.apiKey.length < 10 || account.apiKey.length > 50) {
					throw new InvalidEnvVarError(account.name, envVar)
				}
				account.apiKey = envValue
			}
		}
		return config
	} else {
		throw new WrongConfigFileError(configPath, isConfValid.errors)
	}
}

export class SdkContext {
	public readonly configurationFilePath: string
	private _workingDir: string
	public get workingDir() {
		return this._workingDir
	}
	private _configuration: ConfType
	public get configuration() {
		return this._configuration
	}

	public reload() {
		this._configuration = loadConfig(this.configurationFilePath)
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

	public async updateScript(updatedPath: string) {
		const configs = this.getConfigsForScript(updatedPath)
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
}
