function datePrefix() {
	return new Date().toLocaleTimeString() + " - "
}

export const Logger = {
	log(...[firstParams, ...params]: unknown[]) {
		console.log(`${datePrefix()}${firstParams}`, ...params)
	},
	error(err: unknown) {
		if (err instanceof Error) {
			Logger.log(err.message)
		} else {
			Logger.log(err)
		}
	},
}
