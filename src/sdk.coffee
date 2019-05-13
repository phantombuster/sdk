fs = require 'fs'
path = require 'path'
cson = require 'cson'
needle = require 'needle'
watch = require 'node-watch'
validate = require('is-my-json-valid')(require './configuration-schema.json')
argv = require('yargs').argv

defaultEndpoint = 'https://phantombuster.com/api/v1'
configPath = argv.c or 'phantombuster.cson'

datePrefix = () -> (new Date).toLocaleTimeString() + ' - '

loadConfig = (configPath) ->
	config = cson.load configPath
	if validate config
		for account in config
			if account.apiKey.indexOf("ENV:") is 0
				envVar = account.apiKey.replace("ENV:", "")
				account.apiKey = process.env[envVar]
				if (typeof(account.apiKey) isnt "string") or (account.apiKey.length < 10) or (account.apiKey.length > 50)
					console.log "#{account.name}: Environment variable \"#{envVar}\" does not contain a valid API key"
					process.exit 1
		return config
	else
		console.log "#{datePrefix()}#{configPath} is not a correct SDK configuration file"
		console.log JSON.stringify validate.errors
		process.exit 1

try

	configPath = fs.realpathSync configPath
	baseDir = path.dirname configPath
	config = loadConfig configPath

	updateStoreInfo = (updatedPath, fileType) ->
		linkedScriptJs = updatedPath.replace(new RegExp(fileType + '$'), 'js')
		linkedScriptCoffee = updatedPath.replace(new RegExp(fileType + '$'), 'coffee')
		mdFile = updatedPath.replace(new RegExp(fileType + '$'), 'md')
		jsonFile = updatedPath.replace(new RegExp(fileType + '$'), 'json')
		upload = (account, pbScript, localScript) ->
			fs.readFile jsonFile, (err, jsonText) ->
				if err and (err.code isnt 'ENOENT')
					console.log "#{datePrefix()}#{account.name}: [API store settings] #{jsonFile}: #{err.toString()}"
				else
					if err
						jsonText = ''
					else
						try
							JSON.parse jsonText
						catch e
							jsonErr = e
					if jsonErr
						console.log "#{datePrefix()}#{account.name}: [API store settings] #{jsonFile}: #{jsonErr.toString()}"
					else
						fs.readFile mdFile, (err, mdText) ->
							if err and (err.code isnt 'ENOENT')
								console.log "#{datePrefix()}#{account.name}: [API store settings] #{mdFile}: #{err.toString()}"
							else
								if err
									mdText = ''
								options =
									headers:
										'X-Phantombuster-Key-1': account.apiKey
								payload =
									infoString: jsonText.toString()
									markdown: mdText.toString()
								needle.post "#{account.endpoint or defaultEndpoint}/store-info/by-name/#{pbScript}", payload, options, (err, res) ->
									if err
										console.log "#{datePrefix()}#{account.name}: [API store settings] #{localScript}: #{err.toString()}"
									else
										if res.body?.status is 'success'
											console.log "#{datePrefix()}#{account.name}: [API store settings] #{localScript} -> #{pbScript}"
										else
											console.log "#{datePrefix()}#{account.name}: [API store settings] #{localScript}: #{if res.body?.status? then res.body.status else "Error"}: #{if res.body?.message? then res.body.message else "HTTP #{res.statusCode}"}"
		for account in config
			for pbScript, localScript of account.scripts
				if path.join(baseDir, localScript) in [linkedScriptJs, linkedScriptCoffee]
					upload account, pbScript, localScript
					return yes
		return no

	updateScript = (updatedPath) ->
		fileExt = path.extname(updatedPath)
		if fileExt in ['.md', '.json']
			return updateStoreInfo updatedPath, fileExt.replace('.', '')
		else
			upload = (account, pbScript, localScript, updatedPath) ->
				fs.readFile updatedPath, (err, text) ->
					if err
						console.log "#{datePrefix()}#{account.name}: #{localScript}: #{err.toString()}"
					else
						options =
							headers:
								'X-Phantombuster-Key-1': account.apiKey
						payload =
							text: text.toString()
							source: 'sdk'
						needle.post "#{account.endpoint or defaultEndpoint}/script/#{pbScript}", payload, options, (err, res) ->
							if err
								console.log "#{datePrefix()}#{account.name}: #{localScript}: #{err.toString()}"
							else
								if res.body?.status is 'success'
									console.log "#{datePrefix()}#{account.name}: #{localScript} -> #{pbScript}#{if typeof(res.body.data) is 'number' then ' (new script created)' else ''}"
								else
									console.log "#{datePrefix()}#{account.name}: #{localScript}: #{if res.body?.status? then res.body.status else "Error"}: #{if res.body?.message? then res.body.message else "HTTP #{res.statusCode}"}"
			for account in config
				for pbScript, localScript of account.scripts
					if path.join(baseDir, localScript) is updatedPath
						upload account, pbScript, localScript, updatedPath
						return yes
			return no

	if argv._?.length
		for script in argv._
			if not updateScript(fs.realpathSync(script))
				console.log "#{datePrefix()}#{script}: Not found in configuration"
	else
		watchOptions =
			recursive: yes
			filter: ((f) -> !/node_modules/.test(f))
		watch baseDir, watchOptions, (event, updatedPath) ->
			if event is "update"
				if updatedPath is configPath
					config = loadConfig updatedPath
					console.log "#{datePrefix()}#{updatedPath}: Configuration reloaded"
				else
					updateScript updatedPath

catch e

	console.log e.toString()
	process.exit 1
