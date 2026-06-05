module.exports = {
  preset: "@react-native/jest-preset",
  roots: ["<rootDir>/src", "<rootDir>/packages/core/src"],
  testPathIgnorePatterns: ["/node_modules/", "/firebase-functions/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", {configFile: "./babel.config.jest.js"}],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@react-navigation|react-native-svg|react-native-reanimated|react-native-fbsdk-next|@react-native/js-polyfills))",
  ],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
    "\\.(svg)$": "<rootDir>/src/__mocks__/svgMock.js",
    "\\.(ttf|otf|woff|woff2)$": "<rootDir>/src/__mocks__/fileMock.js",
    "\\.(png|jpg|jpeg|gif|webp|bmp)$": "<rootDir>/src/__mocks__/fileMock.js",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@qwordly/core$": "<rootDir>/packages/core/src/index.ts",
    "^@qwordly/core/(.*)$": "<rootDir>/packages/core/src/$1",
    "^@images/(.*)$": "<rootDir>/assets/images/$1",
    "^@fonts/(.*)$": "<rootDir>/assets/fonts/$1",
    "react-native-fbsdk-next": "<rootDir>/src/__mocks__/react-native-fbsdk-next.js",
    "react-native-reanimated": "<rootDir>/src/__mocks__/react-native-reanimated.js",
  },
  testMatch: ["**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)", "**/*.(test|spec).(js|jsx|ts|tsx)"],
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
