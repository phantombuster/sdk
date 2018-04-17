phantombuster-sdk
=================

https://phantombuster.com/

Provides the `phantombuster` command to facilitate development of scripts for Phantombuster.

To install:

`sudo npm install -g phantombuster-sdk` (recommended)

or

`npm install phantombuster-sdk`

For now, the only feature provided is the uploading of scripts via Phantombuster's API.

phantombuster.cson
------------------

The SDK works with `phantombuster.cson`. This file must be located alongside the scripts, in the same directory (or a parent directory).

This file is simple and self explanatory. The small example below is enough to understand everything:

    [
        name: 'Excellent project 1' # Arbitrary name, only used for logs
        apiKey: 'xxxx' # Phantombuster API key (which identifies the account)
        # Mappings of Phantombuster script names to local script files (relative to the phantombuster.cson file)
        scripts:
            'scraping.js': 'project1/scraping.js'
            'export.js': 'project1/export.js'
    ,
        name: 'Cool project 2'
        apiKey: 'another xxxx'
        scripts:
            'some-casperjs-browsing.js': 'folder/script.js'
    ]

Usage
-----

`phantombuster [-c config.cson] [script.coffee [other.coffee...]]`

* The most typical usage is to watch for file modification while coding. Simply execute `phantombuster` in a directory containing `phantombuster.cson`.
* Specify a different file than `phantombuster.cson`: `phantombuster -c config.cson`
* Upload a specific script to Phantombuster (without watching): `phantombuster project/script.coffee` (must be a value in one of the `scripts` objects in `phantombuster.cson`)
* Update your whole project: `phantombuster project/*.coffee`

See the full documentation here: https://hub.phantombuster.com/docs/sdk
