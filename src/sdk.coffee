fs = require 'fs'
path = require 'path'
cson = require 'cson'
needle = require 'needle'
watch = require 'node-watch'
validate = require('is-my-json-valid')(require './configuration-schema.json')
argv = require('yargs').argv

configPath = argv.c or 'phantombuster.cson'

loadConfig = (configPath) ->
	config = cson.load configPath
	if validate config
		return config
	else
		console.log "#{configPath} is not a correct SDK configuration file"
		console.log JSON.stringify validate.errors
		process.exit 1

try

	configPath = fs.realpathSync configPath
	baseDir = path.dirname configPath
	config = loadConfig configPath

	updateScript = (updatedPath) ->
		for account in config
			for pbScript, localScript of account.scripts
				if path.join(baseDir, localScript) is updatedPath
					fs.readFile updatedPath, (err, text) ->
						if err
							console.log "#{account.name}: #{localScript}: #{err.toString()}"
						else
							options =
								headers:
									'X-Phantombuster-Key-1': account.apiKey
							payload =
								text: text.toString()
							needle.post "https://phantombuster.com/api/v1/script/#{pbScript}", payload, options, (err, res) ->
								if err
									console.log "#{account.name}: #{localScript}: #{err.toString()}"
								else
									if res.body?.status is 'success'
										console.log "#{account.name}: #{localScript} -> #{pbScript}#{if typeof(res.body.data) is 'number' then ' (new script created)' else ''}"
									else
										console.log "#{account.name}: #{localScript}: #{if res.body?.status? then res.body.status else "Error"}: #{if res.body?.message? then res.body.message else "HTTP #{res.statusCode}"}"

	if argv._?.length
		for script in argv._
			updateScript fs.realpathSync script
	else
		watch baseDir, (updatedPath) ->
			if updatedPath is configPath
				config = loadConfig updatedPath
				console.log "#{updatedPath}: Configuration reloaded"
			else
				updateScript updatedPath

catch e

	console.log e.toString()
	process.exit 1
