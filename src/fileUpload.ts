import { extentionRegexp, defaultEndpoint } from "./constants"
import { getJsonFileContent, getFileContent, readFile } from "./files"
import { Logger } from "./Logger"
import { request } from "./requests"
import { IScriptConfig } from "./types"

function catchAndReturnEmtpy(script: IScriptConfig) {
	return function (err: unknown) {
		if (err instanceof Error) {
			Logger.log(`${script.account.name}: ${err.message}`)
		}
		return ""
	}
}

export async function uploadScriptInfo(script: IScriptConfig) {
	const { account, scriptName, scriptPath, realPath } = script

	const jsonText = await getJsonFileContent(realPath.replace(extentionRegexp, ".json")).catch(
		catchAndReturnEmtpy(script),
	)
	const mdText = await getFileContent(realPath.replace(extentionRegexp, ".md")).catch(catchAndReturnEmtpy(script))

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
			Logger.log(`${account.name}: [API store settings] ${scriptPath} -> ${scriptName}`)
		} else {
			Logger.log(
				`${account.name}: [API store settings] ${scriptPath}: ${response.body?.status ?? "Error"}: ${response.body?.message ?? "HTTP " + response.statusCode}`,
			)
		}
	} catch (err) {
		Logger.log(`${account.name}: [API store settings] ${scriptPath}: ${err}`)
	}
}

export async function uploadScript({ account, realPath, scriptName, scriptPath }: IScriptConfig) {
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
				Logger.log(
					`${account.name}: ${scriptPath} -> ${scriptName}${typeof res.body.data === "number" ? " (new script created)" : ""}`,
				)
			} else {
				Logger.log(
					`${account.name}: ${scriptPath}: ${res.body?.status ?? "Error"}: ${res.body?.message ?? "HTTP " + res.statusCode}`,
				)
			}
		} catch (err) {
			Logger.log(`${account.name}: ${scriptPath}: ${err}`)
		}
	} catch (err) {
		Logger.log(`${account.name}: ${scriptPath}: ${err}`)
	}
}
