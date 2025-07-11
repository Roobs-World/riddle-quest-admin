module.exports = {
  preset: "jest-expo",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: [],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@react-navigation|react-native-svg|react-native-reanimated|react-native-fbsdk-next)",
  ],
  moduleNameMapper: {
    "\\.(svg)$": "<rootDir>/src/__mocks__/svgMock.js",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@images/(.*)$": "<rootDir>/assets/images/$1",
    "^@fonts/(.*)$": "<rootDir>/assets/fonts/$1",
    "react-native-fbsdk-next":
      "<rootDir>/src/__mocks__/react-native-fbsdk-next.js",
    "react-native-reanimated":
      "<rootDir>/src/__mocks__/react-native-reanimated.js",
  },
  testMatch: [
    "**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)",
    "**/*.(test|spec).(js|jsx|ts|tsx)",
  ],
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**/*",
    "!src/**/node_modules/**",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  globals: {
    __DEV__: true,
  },
};
