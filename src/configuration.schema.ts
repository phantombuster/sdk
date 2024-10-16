export default {
	$schema: "http://json-schema.org/draft-04/schema#",
	type: "array",
	items: {
		type: "object",
		properties: {
			name: {
				type: "string",
				minLength: 1,
			},
			endpoint: {
				type: "string",
				format: "uri",
			},
			apiKey: {
				type: "string",
				pattern: "^[\\w-:]{5,50}$",
			},
			scripts: {
				type: "object",
				patternProperties: {
					"^[\\w\\. -]{1,50}\\.(?:coffee|js)$": {
						type: "string",
						minLength: 1,
					},
				},
				additionalProperties: false,
			},
		},
		required: ["name", "apiKey"],
		additionalProperties: false,
	},
} as const
