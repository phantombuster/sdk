import yargs from "yargs"
import fs, {realpathSync} from "fs"
import watch from "node-watch"
import path from "path"
import cson from "cson"
import Ajv from "ajv"
import configurationSchema from "./schemas/configuration-schema.json"
import { ConfigurationSchema } from "./generated/configuration-schema"
import needle from "needle"
import util from "util"

const readFile = util.promisify(fs.readFile)

const defaultEndpoint = "https://phantombuster.com/api/v1"
const defaultCson = "phantombuster.cson"
const datePrefix = () => (new Date()).toLocaleTimeString() + " - "

class Sdk {
	private _argv: { c?: string, _: string[] }
	private _configPath: string
	private _baseDir: string
	private _config: ConfigurationSchema

	public constructor() {
		this._argv = yargs.options({ c: { type: "string" } }).argv
		this._configPath = realpathSync(this._argv.c || defaultCson)
		this._baseDir = path.dirname(this._configPath)
		this._config = this._loadConfig(this._configPath)
	}

	public run = async () => {
		if (this._argv._.length > 0) {
			for (const script of this._argv._) {
				if (!(await this._updateScript(realpathSync(script)))) {
					console.log(`${datePrefix()}${script}: Not found in configuration`)
				}
			}
		} else {
			const watchOptions = {
				recursive: true,
				filter(f: string) { return !/node_modules/.test(f) }
			}
			watch(this._baseDir, watchOptions, (event, updatedPath) => {
				if (event === "update") {
					if (updatedPath === this._configPath) {
						this._config = this._loadConfig(updatedPath)
						return console.log(`${datePrefix()}${updatedPath}: Configuration reloaded`)
					} else {
						return this._updateScript(updatedPath)
					}
				}
			})
		}
	}

	private _loadConfig = (cPath: string) => {
		const config = cson.load(cPath)
		const ajv = new Ajv()
		const validate = ajv.compile(configurationSchema)
		if (validate(config)) {
			for (const account of config) {
				if (account.apiKey.indexOf("ENV:") === 0) {
					const envVar = account.apiKey.replace("ENV:", "")
					account.apiKey = process.env[envVar]
					if ((typeof(account.apiKey) !== "string") || (account.apiKey.length < 10) || (account.apiKey.length > 50)) {
						console.log(`${account.name}: Environment variable \"${envVar}\" does not contain a valid API key`)
						process.exit(1)
					}
				}
			}
			return config
		} else {
			console.log(`${datePrefix()}${cPath} is not a correct SDK configuration file`)
			console.log(JSON.stringify(validate.errors))
			return process.exit(1)
		}
	}

	private _uploadScript = async (account: ConfigurationSchema[0], pbScript: string, localScript: string, updatedPath: string) => {
		try {
			const text = await readFile(updatedPath)
			const res = await needle("post", `${account.endpoint || defaultEndpoint}/script/${pbScript}`, {
					text: text.toString(),
					source: "sdk"
				}, { headers: { "X-Phantombuster-Key-1": account.apiKey } }
			)
			if (res.body.status === "success") {
				return console.log(`${datePrefix()}${account.name}: ${localScript} -> ${pbScript}${typeof(res.body.data) === "number" ? " (new script created)" : ""}`)
			} else {
				return console.log(`${datePrefix()}${account.name}: ${localScript}: ${res.body.status ? res.body.status : "Error"}: ${res.body.message ? res.body.message : `HTTP ${res.statusCode}`}`)
			}
		}
		catch (err) {
			return console.log(`${datePrefix()}${account.name}: ${localScript}: ${err.toString()}`)
		}
	}

	private _updateScript = async (updatedPath: string) => {
		const fileExt = path.extname(updatedPath)
		if ([".md", ".json"].includes(fileExt)) {
			return this._updateStoreInfo(updatedPath, fileExt.replace(".", ""))
		} else {
			for (const account of this._config) {
				if (account.scripts) {
					for (const pbScript of Object.keys(account.scripts)) {
						const localScript = account.scripts[pbScript]
						if (path.join(this._baseDir, localScript) === updatedPath) {
							await this._uploadScript(account, pbScript, localScript, updatedPath)
							return true
						}
					}
				}
			}
			return false
		}
	}

	private _uploadStoreInfo = async (account: ConfigurationSchema[0], pbScript: string, localScript: string, jsonFile: string, mdFile: string) => {
		let jsonText = ""
		let mdText = ""

		try {
			jsonText = (await readFile(jsonFile)).toString()
		} catch (err) {
			if (err.code !== "ENOENT") {
				return console.log(`${datePrefix()}${account.name}: [API store settings] ${jsonFile}: ${err.toString()}`)
			}
		}

		try {
			JSON.parse(jsonText)
		} catch (err) {
			return console.log(`${datePrefix()}${account.name}: [API store settings] ${jsonFile}: ${err.toString()}`)
		}

		try {
			mdText = (await readFile(mdFile)).toString()
		} catch (err) {
			if (err.code !== "ENOENT") {
				return console.log(`${datePrefix()}${account.name}: [API store settings] ${mdFile}: ${err.toString()}`)
			}
		}

		try {
			const res = await needle("post", `${account.endpoint || defaultEndpoint}/store-info/by-name/${pbScript}`, {
					infoString: jsonText,
					markdown: mdText,
				}, { headers: { "X-Phantombuster-Key-1": account.apiKey } }
			)
			if (res.body.status === "success") {
				return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript} -> ${pbScript}`)
			} else {
				return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript}: ${res.body.status ? res.body.status : "Error"}: ${res.body.message ? res.body.message : `HTTP ${res.statusCode}`}`)
			}
		} catch (err) {
			return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript}: ${err.toString()}`)
		}
	}

	private _updateStoreInfo = async (updatedPath: string, fileType: string) => {
		const linkedScriptJs = updatedPath.replace(new RegExp(fileType + "$"), "js")
		const linkedScriptCoffee = updatedPath.replace(new RegExp(fileType + "$"), "coffee")
		const mdFile = updatedPath.replace(new RegExp(fileType + "$"), "md")
		const jsonFile = updatedPath.replace(new RegExp(fileType + "$"), "json")

		for (const account of this._config) {
			if (account.scripts) {
				for (const pbScript of Object.keys(account.scripts)) {
					const localScript = account.scripts[pbScript]
					if ([linkedScriptJs, linkedScriptCoffee].includes(path.join(this._baseDir, localScript))) {
						await this._uploadStoreInfo(account, pbScript, localScript, jsonFile, mdFile)
						return true
					}
				}
			}
		}
		return false
	}
}

const sdk = new Sdk()
sdk.run().catch((err) => {
	console.log(err.toString())
	process.exit(1)
})
