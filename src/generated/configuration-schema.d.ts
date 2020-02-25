/**
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file. Run npm run build:models to regenerate it.
 */
/* tslint:disable:trailing-comma array-type indent interface-over-type-literal*/

export type ConfigurationSchema = {
	name: string
	endpoint?: string
	apiKey: string
	scripts?: {
		/**
		 * This interface was referenced by `undefined`'s JSON-Schema definition
		 * via the `patternProperty` "^[\w\. -]{1,50}\.(?:coffee|js)$".
		 */
		[k: string]: string
	}
}[]
