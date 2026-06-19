/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
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
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
