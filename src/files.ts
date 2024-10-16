import fs, { existsSync } from "fs"
import { FileReadError, JSONParseError } from "./errors"

export function readFile(filename: string) {
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

export async function getJsonFileContent(realPath: string): Promise<string> {
	const jsonContent = await getFileContent(realPath)
	try {
		JSON.parse(jsonContent)
		return jsonContent
	} catch (err) {
		throw new JSONParseError(realPath, err)
	}
}

export async function getFileContent(realPath: string): Promise<string> {
	if (existsSync(realPath)) {
		try {
			return await readFile(realPath)
		} catch (err) {
			if (!(err && typeof err === "object") || !("code" in err) || err.code !== "ENOENT") {
				throw new FileReadError(realPath, err)
			}
		}
	}
	return ""
}
