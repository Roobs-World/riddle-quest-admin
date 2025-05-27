/* eslint-env node */
module.exports = {
  rootDir: ".",
  roots: ["<rootDir>"],
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "!lib/**"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  clearMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  moduleNameMapper: {
    "^jose$": "<rootDir>/__mocks__/jose.js",
    "^jwks-rsa$": "<rootDir>/__mocks__/jwks-rsa.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!(?:@firebase|firebase)/)"],
  setupFiles: ["<rootDir>/jest.env.setup.js"],
  testTimeout: 90000,
};
