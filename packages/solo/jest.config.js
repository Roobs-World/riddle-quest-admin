/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testEnvironmentOptions: {globalsCleanup: "on"},
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)", "**/*.(test|spec).(ts|tsx)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@riddle-quest/core$": "<rootDir>/../core/src/index.ts",
    "^@riddle-quest/core/(.*)$": "<rootDir>/../core/src/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/*.{test,spec}.{ts,tsx}",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "json-summary"],
};
