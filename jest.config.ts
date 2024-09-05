import type { JestConfigWithTsJest } from "ts-jest/dist/types"

const config: JestConfigWithTsJest = {
	preset: "ts-jest",
	testEnvironment: "node",
	transform: {
		"^.+\\.ts$": "@swc/jest",
	},
	modulePathIgnorePatterns: [".*.js"],
	collectCoverageFrom: [
		"src/**/*.ts",
		"src/**/*.js",
		"!**/*.test.{js,ts,tsx}",
		"!**/*.spec.{js,ts,tsx}",
		"!**/*.d.ts",
	],
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
}
export default config
