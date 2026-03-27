/**
 * Jest Configuration for reactive-resume
 *
 * Tests for:
 * - oRPC endpoints (dashboard, comments, evaluations, checklists)
 * - React components (3-column editor, feedback panel, etc.)
 * - E2E workflows
 */

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx",
    "!src/**/__tests__/**",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/integrations/(.*)$": "<rootDir>/src/integrations/$1",
    "^@/routes/(.*)$": "<rootDir>/src/routes/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@/schema/(.*)$": "<rootDir>/src/schema/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup-global.ts"],
  testTimeout: 30000,
  globals: {
    "ts-jest": {
      tsconfig: {
        jsx: "react",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/dist/",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
