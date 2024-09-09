import type { AsTyped } from "as-typed"
import type conf from "./configuration.schema"

export type ConfType = Array<
	AsTyped<typeof conf>[number] & {
		scripts?: Record<string, string>
	}
>

export interface IAccount {
	name: string
	apiKey: string
	endpoint?: string
}

export interface IScriptConfig {
	account: IAccount
	scriptPath: string
	scriptName: string
	realPath: string
}
