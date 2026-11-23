const path = require("node:path");

/** @type {import('jest').Config} */
module.exports = {
  preset: "@react-native/jest-preset",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    // Shared source must use the native app's React and Firebase instances.
    "^react$": require.resolve("react"),
    "^react/(.*)$": "<rootDir>/node_modules/react/$1",
    "^firebase/(.*)$": "<rootDir>/node_modules/firebase/$1",
    "^#solo-content$": "<rootDir>/../../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json",
    "^#hosted-config$": "<rootDir>/hosted.config.example.json",
  },
  // pnpm nests packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>;
  // keep React Native's untranspiled sources and the native modules transformable.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|react-native|@react-native|@react-native-community|@react-native-async-storage|react-native-safe-area-context)/)",
  ],
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/test/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "json-summary"],
  coverageThreshold: {
    global: {statements: 93, branches: 88, functions: 90, lines: 94},
    [path.resolve(__dirname, "src/entries/androidEntryInboxSchema.ts")]: {
      statements: 100, branches: 100, functions: 100, lines: 100,
    },
  },
};
