#!/usr/bin/env node

import watch from "node-watch"
import { argv } from "yargs"

import { Logger } from "./Logger"
import { LoggableError } from "./errors"
import { SdkContext } from "./SdkContext"

async function main() {
	const args = await argv
	const CONFIG_PATH = (args.c as string) || "phantombuster.cson"
	const ctx = new SdkContext(CONFIG_PATH)
	if (args._?.length) {
		for (const script of args._) {
			if (!(await ctx.updateScript(script as string))) {
				Logger.log(`${script}: Not found in configuration`)
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
					ctx.reload()
					Logger.log(`${updatedPath}: Configuration reloaded`)
				} else {
					await ctx.updateScript(updatedPath)
				}
			}
		})
	}
}

main().catch((error) => {
	if (error instanceof LoggableError) {
		error.logError()
	} else {
		console.log(error.toString())
	}
	process.exit(1)
})
