/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/loadEnv.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  testTimeout: 15000,
  // Integration tests share one real Postgres connection and truncate tables
  // between tests — running suites in parallel would race on the same tables,
  // so this is meant to run with --runInBand (see the "test" npm script).
  maxWorkers: 1,
};
