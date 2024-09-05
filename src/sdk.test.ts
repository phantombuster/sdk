// import * as nodeWatch from "node-watch"s

import fs from "fs"

function getSut(sdkPath: string) {
	process.env.LIBRARY_API_KEY = "LIBRARY_API_KEY"

	const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
		return null as never
	})
	const postSpy = jest.fn()
	jest.mock("needle", () => ({ post: postSpy }))
	const watchMock = jest.fn().mockImplementation(() => {})
	const logFunc = jest.spyOn(console, "log").mockImplementation(() => {})

	jest.mock("node-watch", () => watchMock)
	jest.mock("cson", () => ({
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		load: jest.fn().mockImplementation((configName) => require(configName)),
	}))
	jest.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("DATE")

	const realFs: typeof import("fs") = jest.requireActual("fs")

	const readFileSpy = jest.spyOn(realFs, "readFile")

	async function launchingScript() {
		await import(sdkPath)
		await new Promise<void>((resolve) => setTimeout(resolve, 25))
	}
	return {
		given: {
			noLibKeyVariable() {
				// process.env.LIBRARY_API_KEY = undefined
				delete process.env.LIBRARY_API_KEY
			},
			cmdArguments(configFile: string, scriptToProcess?: string[]) {
				jest.mock("yargs", () => ({
					argv: {
						c: realFs.realpathSync(configFile),
						_: scriptToProcess,
					},
				}))
			},
			fileContentIs(file: string, content: string) {
				readFileSpy.mockImplementationOnce((filename, func) => {
					if (filename.toString().includes(file)) {
						func(null, Buffer.from(content))
					} else {
						realFs.readFile(filename, func)
					}
				})
			},
			fileIsUnreadable(file: string, error: Error) {
				readFileSpy.mockImplementationOnce((filename, func) => {
					if (filename.toString().includes(file)) {
						func(error, Buffer.from("content"))
					} else {
						realFs.readFile(filename, func)
					}
				})
			},
			apiAnswer(answer: {
				body?: {
					status?: string
					message?: string
					data?: number
				}
				statusCode: number
			}) {
				postSpy.mockImplementation((_a, _b, _c, func) => func(null, answer))
			},
			apiError(error: Error) {
				postSpy.mockImplementation((_a, _b, _c, func) => func(error))
			},
		},
		when: {
			launchingScript,
			async updatingFileInWatchMode(fileName: string) {
				let promiseToWait = Promise.resolve()
				watchMock.mockImplementation((_a, _b, func) => {
					try {
						promiseToWait = func("update", realFs.realpathSync(fileName))
					} catch {
						promiseToWait = func("update", fileName)
					}
				})
				await launchingScript()
				await promiseToWait
			},
			async watchThrowAnError(error: Error) {
				watchMock.mockImplementationOnce(() => {
					throw error
				})
				await launchingScript()
			},
		},
		then: {
			watcherShouldNotLaunch() {
				expect(watchMock).not.toHaveBeenCalled()
			},
			watcherShouldLaunch() {
				expect(watchMock).toHaveBeenCalledTimes(1)
			},
			logShouldBeWritten(log: string) {
				expect(logFunc).toHaveBeenCalledWith(log)
			},
			logShouldNotBeWritten() {
				expect(logFunc).not.toHaveBeenCalled()
			},
			scriptShouldExitWithError() {
				expect(exitSpy).toHaveBeenCalledWith(1)
			},
			upsertScriptShouldBeCalledWith(scriptName: string, scriptContent: string) {
				expect(postSpy).toHaveBeenCalledWith(
					`https://api-staging.phantombuster.io/api/v1/script/${scriptName}`,
					{ source: "sdk", text: scriptContent },
					{ headers: { "X-Phantombuster-Key-1": "LIBRARY_API_KEY" }, json: true },
					expect.anything(),
				)
			},
			upsertScriptInfoShouldBeCalledWith(
				fileName: string,
				{
					json,
					md,
				}: {
					json: string
					md: string
				},
			) {
				expect(postSpy).toHaveBeenCalledWith(
					`https://api-staging.phantombuster.io/api/v1/store-info/by-name/${fileName}`,
					{ infoString: json, markdown: md },
					{ headers: { "X-Phantombuster-Key-1": "LIBRARY_API_KEY" }, json: true },
					expect.anything(),
				)
			},
		},
	}
}

beforeEach(() => {
	jest.resetModules()
})

afterEach(() => {
	jest.restoreAllMocks()
})

describe.each([
	"./sdk.js", //old sdk
	"./sdk.ts", //new sdk
] as const)("sdk %s", (sdkPath) => {
	it("should launch watch if started with only config argument", async () => {
		const sut = getSut(sdkPath)
		sut.given.cmdArguments("src/__fixtures__/config.json")
		await sut.when.launchingScript()
		sut.then.watcherShouldLaunch()
	})

	it("should log error and exit if watch throw", async () => {
		const sut = getSut(sdkPath)
		sut.given.cmdArguments("src/__fixtures__/config.json")
		await sut.when.watchThrowAnError(new Error("something went wrong"))
		sut.then.logShouldBeWritten("Error: something went wrong")
		sut.then.scriptShouldExitWithError()
	})

	it("should log if configuration reload", async () => {
		const sut = getSut(sdkPath)
		sut.given.cmdArguments("src/__fixtures__/config.json")
		await sut.when.updatingFileInWatchMode("src/__fixtures__/config.json")
		sut.then.logShouldBeWritten(
			"DATE - " + fs.realpathSync("src/__fixtures__/config.json") + ": Configuration reloaded",
		)
	})

	it("should not launch if config as wrong format", async () => {
		const sut = getSut(sdkPath)
		sut.given.cmdArguments("src/__fixtures__/wrongConfig.json")
		await sut.when.launchingScript()
		sut.then.logShouldBeWritten(
			"DATE - " +
				fs.realpathSync("src/__fixtures__/wrongConfig.json") +
				" is not a correct SDK configuration file",
		)
	})

	it("should not launch watch if started with files as arguments", async () => {
		const sut = getSut(sdkPath)
		sut.given.cmdArguments("src/__fixtures__/config.json", [
			"src/__fixtures__/unconfigured.js",
			"src/__fixtures__/test.js",
		])
		sut.given.apiAnswer({
			statusCode: 200,
			body: {
				status: "success",
			},
		})
		await sut.when.launchingScript()

		sut.then.watcherShouldNotLaunch()
		sut.then.logShouldBeWritten("DATE - src/__fixtures__/unconfigured.js: Not found in configuration")
		sut.then.logShouldBeWritten("DATE - library: ./test.js -> Test.js")
	})

	it("should not launch with wrong env var", async () => {
		const sut = getSut(sdkPath)
		sut.given.noLibKeyVariable()
		sut.given.cmdArguments("src/__fixtures__/config.json")
		await sut.when.launchingScript()
		sut.then.logShouldBeWritten('library: Environment variable "LIBRARY_API_KEY" does not contain a valid API key')
		sut.then.scriptShouldExitWithError()
	})

	describe("api calls", () => {
		it("should call the api for correct js file", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode("src/__fixtures__/test.js")

			sut.then.upsertScriptShouldBeCalledWith("Test.js", 'console.log("test")\n')
		})

		it("should call the api for correct json file", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode("src/__fixtures__/test.json")

			sut.then.upsertScriptInfoShouldBeCalledWith("Test.js", {
				json: '{\n\t"slug": "test"\n}\n',
				md: "markdown test\n",
			})
		})

		it("should call the api for correct json file without markdown", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode("src/__fixtures__/test2.json")

			sut.then.upsertScriptInfoShouldBeCalledWith("Test2.js", {
				json: '{\n\t"slug": "test2"\n}\n',
				md: "",
			})
		})

		it("should call the api for correct md file", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode("src/__fixtures__/test.md")

			sut.then.upsertScriptInfoShouldBeCalledWith("Test.js", {
				json: '{\n\t"slug": "test"\n}\n',
				md: "markdown test\n",
			})
		})
	})

	describe("script file change", () => {
		const file = "src/__fixtures__/test.js"

		it("should not log if script does not exists bis", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})
			await sut.when.updatingFileInWatchMode("unconfigured.js")
			sut.then.logShouldNotBeWritten()
		})

		it("should log if script is updated", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js -> Test.js")
		})

		it("should log if script is created", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					data: 2,
				},
				statusCode: 200,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js -> Test.js (new script created)")
		})

		it("should log status code as error if no message", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js: Error: HTTP 412")
		})

		it("should log message error", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
				},
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js: Error: not found")
		})

		it("should log message error with status if exists", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
					status: "status",
				},
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js: status: not found")
		})

		it("should log message error if sdkrequest failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiError(new Error("request failed"))
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js: Error: request failed")
		})

		it("should log message error if reading file failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiError(new Error("request failed"))
			sut.given.fileIsUnreadable(file, new Error("error while reading file"))

			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: ./test.js: Error: error while reading file")
		})
	})

	describe("json file change", () => {
		const file = "src/__fixtures__/test.json"

		it("should not log if file does not exists", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})
			sut.given.fileContentIs(file, "{}")
			await sut.when.updatingFileInWatchMode("toto.json")
			sut.then.logShouldNotBeWritten()
		})

		it("should log if file is updated", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log if script is created", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					data: 2,
				},
				statusCode: 200,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log status code as error if no message", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: HTTP 412")
		})

		it("should log message error", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
				},
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: not found")
		})

		it("should log message error with status if exists", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
					status: "status",
				},
				statusCode: 412,
			})
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: status: not found")
		})

		it("should log message error if sdkrequest failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiError(new Error("request failed"))
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: request failed")
		})

		it("should log message error if reading file failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
				},
				statusCode: 200,
			})
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
				},
				statusCode: 200,
			})
			sut.given.fileIsUnreadable(file, new Error("error while reading file"))
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten(
				"DATE - library: [API store settings] " + fs.realpathSync(file) + ": Error: error while reading file",
			)
		})

		it("should log message error if raising 'ENOENT' error", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
				},
				statusCode: 200,
			})
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
				},
				statusCode: 200,
			})
			const error = new Error("error while reading file") as Error & { code: string }
			error.code = "ENOENT"
			sut.given.fileIsUnreadable(file, error)
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log message error if file does not contains JSON", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiError(new Error("request failed"))
			sut.given.fileContentIs(file, "toto")
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten(
				"DATE - library: [API store settings] " +
					fs.realpathSync(file) +
					": SyntaxError: Unexpected token 'o', \"toto\" is not valid JSON",
			)
		})
	})

	describe("md file change", () => {
		const file = "src/__fixtures__/test.md"

		it("should not log if file does not exists", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})
			sut.given.fileContentIs(file, "{}")
			await sut.when.updatingFileInWatchMode("toto.json")
			sut.then.logShouldNotBeWritten()
		})

		it("should log if file is updated", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					// data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log if script is created", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
					data: 2,
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log status code as error if no message", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				statusCode: 412,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: HTTP 412")
		})

		it("should log message error", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
				},
				statusCode: 412,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: not found")
		})

		it("should log message error with status if exists", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					message: "not found",
					status: "status",
				},
				statusCode: 412,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: status: not found")
		})

		it("should log message error if sdkrequest failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiError(new Error("request failed"))

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js: Error: request failed")
		})

		it("should log message error if raising 'ENOENT' error", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			sut.given.apiAnswer({
				body: {
					status: "success",
				},
				statusCode: 200,
			})
			sut.given.apiAnswer({
				body: {
					status: "success",
					message: "",
				},
				statusCode: 200,
			})
			const error = new Error("error while reading file") as Error & { code: string }
			error.code = "ENOENT"
			sut.given.fileIsUnreadable(file, error)
			await sut.when.updatingFileInWatchMode(file)
			sut.then.logShouldBeWritten("DATE - library: [API store settings] ./test.js -> Test.js")
		})

		it("should log message error if reading file failed", async () => {
			const sut = getSut(sdkPath)
			sut.given.cmdArguments("src/__fixtures__/config.json")
			const error = new Error("error while reading file") as Error & { code: string }
			error.code = "ENOENT"
			sut.given.fileIsUnreadable(file.replace(".md", ".json"), error)
			sut.given.fileIsUnreadable(file, new Error("error while reading file"))
			sut.given.apiAnswer({
				body: {
					status: "success",
				},
				statusCode: 200,
			})

			await sut.when.updatingFileInWatchMode(file)

			sut.then.logShouldBeWritten(
				"DATE - library: [API store settings] " + fs.realpathSync(file) + ": Error: error while reading file",
			)
		})
	})
})
