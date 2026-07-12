/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@qwordly/core$": "<rootDir>/../core/src/index.ts",
    "^@qwordly/core/(.*)$": "<rootDir>/../core/src/$1",
    "^\\./localeModules$": "<rootDir>/src/test/localeModulesMock.ts",
    "\\.(css|less|scss)$": "<rootDir>/src/test/styleMock.cjs",
    "\\.(svg|png|jpg|jpeg|webp)$": "<rootDir>/src/test/fileMock.cjs",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
