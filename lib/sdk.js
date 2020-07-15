#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const fs_1 = __importStar(require("fs"));
const node_watch_1 = __importDefault(require("node-watch"));
const path_1 = __importDefault(require("path"));
const cson_1 = __importDefault(require("cson"));
const ajv_1 = __importDefault(require("ajv"));
const configuration_schema_json_1 = __importDefault(require("./schemas/configuration-schema.json"));
const needle_1 = __importDefault(require("needle"));
const util_1 = __importDefault(require("util"));
const readFile = util_1.default.promisify(fs_1.default.readFile);
const defaultEndpoint = "https://phantombuster.com/api/v1";
const defaultCson = "phantombuster.cson";
const datePrefix = () => (new Date()).toLocaleTimeString() + " - ";
class Sdk {
    constructor() {
        this.run = async () => {
            if (this._argv._.length > 0) {
                for (const script of this._argv._) {
                    if (!(await this._updateScript(fs_1.realpathSync(script)))) {
                        console.log(`${datePrefix()}${script}: Not found in configuration`);
                    }
                }
            }
            else {
                const watchOptions = {
                    recursive: true,
                    filter: (f) => { return !/node_modules/.test(f); },
                };
                node_watch_1.default(this._baseDir, watchOptions, (event, updatedPath) => {
                    if (event === "update") {
                        if (updatedPath === this._configPath) {
                            this._config = this._loadConfig(updatedPath);
                            return console.log(`${datePrefix()}${updatedPath}: Configuration reloaded`);
                        }
                        else {
                            return this._updateScript(updatedPath);
                        }
                    }
                });
            }
        };
        this._loadConfig = (cPath) => {
            const config = cson_1.default.load(cPath);
            const ajv = new ajv_1.default();
            const validate = ajv.compile(configuration_schema_json_1.default);
            if (validate(config)) {
                for (const account of config) {
                    if (account.apiKey.indexOf("ENV:") === 0) {
                        const envVar = account.apiKey.replace("ENV:", "");
                        account.apiKey = process.env[envVar];
                        if ((typeof (account.apiKey) !== "string") || (account.apiKey.length < 10) || (account.apiKey.length > 50)) {
                            console.log(`${account.name}: Environment variable "${envVar}" does not contain a valid API key`);
                            process.exit(1);
                        }
                    }
                }
                return config;
            }
            else {
                console.log(`${datePrefix()}${cPath} is not a correct SDK configuration file`);
                console.log(JSON.stringify(validate.errors));
                return process.exit(1);
            }
        };
        this._uploadScript = async (account, pbScript, localScript, updatedPath) => {
            try {
                const text = await readFile(updatedPath);
                const res = await needle_1.default("post", `${account.endpoint || defaultEndpoint}/script/${pbScript}`, {
                    text: text.toString(),
                    source: "sdk",
                }, { headers: { "X-Phantombuster-Key-1": account.apiKey } });
                if (res.body.status === "success") {
                    return console.log(`${datePrefix()}${account.name}: ${localScript} -> ${pbScript}${typeof (res.body.data) === "number" ? " (new script created)" : ""}`);
                }
                else {
                    return console.log(`${datePrefix()}${account.name}: ${localScript}: ${res.body.status ? res.body.status : "Error"}: ${res.body.message ? res.body.message : `HTTP ${res.statusCode}`}`);
                }
            }
            catch (err) {
                return console.log(`${datePrefix()}${account.name}: ${localScript}: ${err.toString()}`);
            }
        };
        this._updateScript = async (updatedPath) => {
            const fileExt = path_1.default.extname(updatedPath);
            if ([".md", ".json"].includes(fileExt)) {
                return this._updateStoreInfo(updatedPath, fileExt.replace(".", ""));
            }
            else {
                for (const account of this._config) {
                    if (account.scripts) {
                        for (const pbScript of Object.keys(account.scripts)) {
                            const localScript = account.scripts[pbScript];
                            if (path_1.default.join(this._baseDir, localScript) === updatedPath) {
                                await this._uploadScript(account, pbScript, localScript, updatedPath);
                                return true;
                            }
                        }
                    }
                }
                return false;
            }
        };
        this._uploadStoreInfo = async (account, pbScript, localScript, jsonFile, mdFile) => {
            let jsonText = "";
            let mdText = "";
            try {
                jsonText = (await readFile(jsonFile)).toString();
            }
            catch (err) {
                if (err.code !== "ENOENT") {
                    return console.log(`${datePrefix()}${account.name}: [API store settings] ${jsonFile}: ${err.toString()}`);
                }
            }
            try {
                JSON.parse(jsonText);
            }
            catch (err) {
                return console.log(`${datePrefix()}${account.name}: [API store settings] ${jsonFile}: ${err.toString()}`);
            }
            try {
                mdText = (await readFile(mdFile)).toString();
            }
            catch (err) {
                if (err.code !== "ENOENT") {
                    return console.log(`${datePrefix()}${account.name}: [API store settings] ${mdFile}: ${err.toString()}`);
                }
            }
            try {
                const res = await needle_1.default("post", `${account.endpoint || defaultEndpoint}/store-info/by-name/${pbScript}`, {
                    infoString: jsonText,
                    markdown: mdText,
                }, { headers: { "X-Phantombuster-Key-1": account.apiKey } });
                if (res.body.status === "success") {
                    return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript} -> ${pbScript}`);
                }
                else {
                    return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript}: ${res.body.status ? res.body.status : "Error"}: ${res.body.message ? res.body.message : `HTTP ${res.statusCode}`}`);
                }
            }
            catch (err) {
                return console.log(`${datePrefix()}${account.name}: [API store settings] ${localScript}: ${err.toString()}`);
            }
        };
        this._updateStoreInfo = async (updatedPath, fileType) => {
            const linkedScriptJs = updatedPath.replace(new RegExp(fileType + "$"), "js");
            const linkedScriptCoffee = updatedPath.replace(new RegExp(fileType + "$"), "coffee");
            const mdFile = updatedPath.replace(new RegExp(fileType + "$"), "md");
            const jsonFile = updatedPath.replace(new RegExp(fileType + "$"), "json");
            for (const account of this._config) {
                if (account.scripts) {
                    for (const pbScript of Object.keys(account.scripts)) {
                        const localScript = account.scripts[pbScript];
                        if ([linkedScriptJs, linkedScriptCoffee].includes(path_1.default.join(this._baseDir, localScript))) {
                            await this._uploadStoreInfo(account, pbScript, localScript, jsonFile, mdFile);
                            return true;
                        }
                    }
                }
            }
            return false;
        };
        this._argv = yargs_1.default.options({ c: { type: "string" } }).argv;
        this._configPath = fs_1.realpathSync(this._argv.c || defaultCson);
        this._baseDir = path_1.default.dirname(this._configPath);
        this._config = this._loadConfig(this._configPath);
    }
}
const sdk = new Sdk();
sdk.run().catch((err) => {
    console.log(err.toString());
    process.exit(1);
});
