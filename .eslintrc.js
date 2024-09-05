/** @type {import('eslint').Linter.Config} */
/* eslint-disable @typescript-eslint/no-require-imports*/
module.exports = {
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	parser: "@typescript-eslint/parser",
	plugins: [
		"deprecation",
		"@typescript-eslint",
		"prefer-arrow",
		"toplevel",
		"regexp",
		"promise",
		"prettier",
		"sonarjs",
	],
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/eslint-recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:regexp/recommended",
		"plugin:promise/recommended",
		"plugin:prettier/recommended",
	],
	parserOptions: {
		project: ["tsconfig.json"],
		ecmaVersion: 9,
		sourceType: "module",
	},
	rules: {
		"class-methods-use-this": "error",
		"toplevel/no-toplevel-var": "error",
		"toplevel/no-toplevel-let": "error",
		"promise/no-callback-in-promise": "error",
		"deprecation/deprecation": "warn",
		"@typescript-eslint/no-extra-semi": "off",
		"prettier/prettier": [
			"error",
			{},
			{
				usePrettierrc: true,
			},
		],
		"@typescript-eslint/no-unused-vars": ["error", { vars: "all", args: "after-used", ignoreRestSiblings: true }],
		"@typescript-eslint/no-var-requires": "off", // Disallows the use of require statements except in import statements
		"@typescript-eslint/no-explicit-any": ["error"], // Disallow the use of "any"",
		curly: "error",
		"@typescript-eslint/no-loss-of-precision": "warn",
		"no-loss-of-precision": "warn",
		"@typescript-eslint/no-floating-promises": "error", // Promises returned by functions must be handled appropriately
		"no-duplicate-imports": "error",
		"linebreak-style": ["error", "unix"],
		eqeqeq: ["error", "always"],
		"no-implied-eval": ["error"],
		"no-new-func": ["error"],
		"no-new-wrappers": ["error"],
		"no-void": ["error"],
		"wrap-iife": ["error", "any"],
		radix: ["error", "always"],
		yoda: ["error", "never"],
		"comma-dangle": ["error", "only-multiline"],
		"no-array-constructor": ["error"],
		"no-var": ["error"],
		"no-empty": ["error"],
		"no-debugger": ["error"],
		"no-unreachable": ["error"],
		"no-caller": ["error"],
		"no-with": ["error"],
		"eol-last": ["warn", "always"],
		"no-constant-condition": ["off"],
		"no-mixed-spaces-and-tabs": ["off"],
		"no-multi-spaces": ["warn"],
		"no-return-await": ["error"],
		"no-sequences": ["error"],
		"no-useless-call": ["error"],
		"no-useless-concat": ["error"],
		"no-undefined": ["off"],
		"no-undef-init": ["error"],
		"brace-style": [
			"warn",
			"1tbs",
			{
				allowSingleLine: true,
			},
		],
		"block-spacing": ["warn"],
		"space-in-parens": ["warn"],
		"keyword-spacing": ["warn"],
		"space-infix-ops": ["warn"],
		"no-new-object": ["error"],
		"no-nested-ternary": ["error"],
		"no-multi-assign": ["warn"],
		"no-lonely-if": ["warn"],
		"new-parens": ["error"],
		"new-cap": ["error"],
		"require-await": "off",
		"@typescript-eslint/require-await": "error",
		"func-style": ["warn", "declaration"],
		"max-statements-per-line": [
			"warn",
			{
				max: 2,
			},
		],
		"max-nested-callbacks": [
			"warn",
			{
				max: 3,
			},
		],
		"prefer-const": "error", // Suggest using const when possible
		"@typescript-eslint/prefer-for-of": "error", // Recommends a ‘for-of’ loop over a standard ‘for’ loop if the index is only used to access the array being iterated
		// "@typescript-eslint/consistent-type-definitions": ["error"], // interface over type when applicable
	},
	overrides: [
		{
			settings: {
				jest: {
					version: require("jest/package.json").version,
				},
			},
			files: ["**__tests__**", "**.test.ts", "**.spec.ts", "**__fixtures__**"],
			plugins: ["jest", "jest-formatting"],
			extends: ["plugin:jest/recommended", "plugin:jest-formatting/recommended"],
			env: {
				"jest/globals": true,
			},
			rules: {
				"max-nested-callbacks": 0,
				"sonarjs/no-duplicate-string": "off",
				"jest/expect-expect": [
					"warn",
					{
						assertFunctionNames: ["expect*", "*.then*"],
						additionalTestBlockFunctions: [],
					},
				],
			},
		},
	],
}
