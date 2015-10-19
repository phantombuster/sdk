fs = require 'fs'
path = require 'path'
cson = require 'cson'
needle = require 'needle'
watch = require 'node-watch'
argv = require('yargs').argv

script = argv._?[0] or null
configPath = argv.c or 'phantombuster.cson'

loadConfig = (configPath) ->
	# TODO json schema validation
	cson.load configPath

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
							console.log "[#{account.name}] #{updatedPath}: #{err.toString()}"
						else
							options =
								headers:
									'X-Phantombuster-Key-1': account.apiKey
							payload =
								text: text.toString()
							needle.post "https://phantombuster.com/api/v1/script/#{pbScript}", payload, options, (err, res) ->
								if err
									console.log "[#{account.name}] #{updatedPath}: #{err.toString()}"
								else
									if res.body?.status is 'success'
										if typeof(res.body.data) is 'number'
											console.log "[#{account.name}] #{updatedPath}: New script #{pbScript} created"
										else
											console.log "[#{account.name}] #{updatedPath}: Script #{pbScript} updated"
									else
										console.log "[#{account.name}] #{updatedPath}: #{if res.body?.status? then res.body.status else "Error"}: #{if res.body?.message? then res.body.message else "HTTP #{res.statusCode}"}"
					return

	if script
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
