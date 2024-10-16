import type { JestConfigWithTsJest } from "ts-jest/dist/types"

const config: JestConfigWithTsJest = {
	preset: "ts-jest",
	testEnvironment: "node",
	transform: {
		"^.+\\.ts$": "@swc/jest",
	},
	modulePathIgnorePatterns: [".*__fixtures__.*.js"],
	collectCoverageFrom: [
		"src/**/*.ts",
		"src/**/*.js",
		"!**/*.test.{js,ts,tsx}",
		"!**/*.spec.{js,ts,tsx}",
		"!**/*.d.ts",
	],
	coverageThreshold: {
		global: {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
	},
}
export default config
