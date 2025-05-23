module.exports = {
  rootDir: ".",
  roots: ["<rootDir>"],
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        babelConfig: {
          babelrc: false,
          configFile: false,
          presets: [["@babel/preset-env", {targets: {node: "current"}}]],
        },
      },
    ],
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // An array of glob patterns indicating a set of files for which coverage
  // information should be collected
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  moduleNameMapper: {
    "^(\.{1,2}/.*)\.js$": "$1.ts",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@firebase/.*|firebase/.*|other-esm-package)/)"],
  testTimeout: 30000,
};
