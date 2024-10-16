import type { ValidationError } from "is-my-json-valid"
import { Logger } from "./Logger"

export abstract class LoggableError extends Error {
	abstract logError(): void
}

export class InvalidEnvVarError extends LoggableError {
	constructor(accountName: string, varName: string) {
		super(`${accountName}: Environment variable "${varName}" does not contain a valid API key`)
	}
	logError() {
		console.log(this.message)
	}
}

export class WrongConfigFileError extends LoggableError {
	constructor(
		configPath: string,
		private readonly errors: ValidationError[],
	) {
		super(`${configPath} is not a correct SDK configuration file`)
	}

	logError() {
		Logger.log(this.message)
		console.log(JSON.stringify(this.errors))
	}
}

export class SdkFileProcessError extends Error {
	constructor(
		public readonly filePath: string,
		error: unknown,
	) {
		const label = filePath.endsWith(".json") || filePath.endsWith(".md") ? "[API store settings] " : ""
		super(`${label}${filePath}: ${error}`)
	}
}

export class FileReadError extends SdkFileProcessError {
	//
}
export class JSONParseError extends FileReadError {
	//
}
