import { IScriptConfig } from "./types"

function datePrefix() {
	return new Date().toLocaleTimeString() + " - "
}

export const Logger = {
	log(...[firstParams, ...params]: unknown[]) {
		console.log(`${datePrefix()}${firstParams}`, ...params)
	},
	success({ account, scriptName, scriptPath, realPath }: IScriptConfig, created = false) {
		const label = realPath.endsWith(".json") || realPath.endsWith(".md") ? "[API store settings] " : ""
		const postLabel = created ? " (new script created)" : ""
		Logger.log(`${account.name}: ${label}${scriptPath} -> ${scriptName}${postLabel}`)
	},
	error(err: unknown) {
		if (err instanceof Error) {
			Logger.log(err.message)
		} else {
			Logger.log(err)
		}
	},
}
