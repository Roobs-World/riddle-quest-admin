/** @type {import('jest').Config} */
module.exports = {
  preset: "@react-native/jest-preset",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    "^#solo-content$": "<rootDir>/../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json",
    "^@qwordly/core$": "<rootDir>/../core/src/index.ts",
    "^@qwordly/core/(.*)$": "<rootDir>/../core/src/$1",
    "^@qwordly/solo$": "<rootDir>/../solo/src/index.ts",
    "^@qwordly/solo/react$": "<rootDir>/../solo/src/react/index.ts",
  },
  // pnpm nests packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>;
  // keep React Native's untranspiled sources and the native modules transformable.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|react-native|@react-native|@react-native-community|@react-native-async-storage|react-native-safe-area-context)/)",
  ],
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/test/**"],
  coverageDirectory: "coverage",
};
