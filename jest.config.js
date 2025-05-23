module.exports = {
  preset: "jest-expo",
  rootDir: ".",
  verbose: true,
  setupFilesAfterEnv: [
    "./jest.setup.js", // For any global mocks or setup
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleDirectories: ["node_modules", "node_modules/.pnpm"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      { configFile: "./babel.config.js" },
    ],
  },
  moduleNameMapper: {
    "^@testing-library/react-native/extend-expect$":
      "@testing-library/react-native",
    "^@react-native/js-polyfills/error-guard$":
      "<rootDir>/__mocks__/custom/emptyErrorGuard.js",
    "^@react-native/js-polyfills$":
      "<rootDir>/__mocks__/@react-native/js-polyfills.js",
    // Mock for static assets
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(" +
      "@react-native/js-polyfills|" +
      "jest-runner|" +
      "@react-native|" +
      "react-native|" +
      "react-native-unistyles|" +
      "expo-modules-core|" +
      "@expo/vector-icons|" +
      "expo-font|" +
      "expo-asset|" +
      "expo-constants|" +
      "expo-file-system|" +
      "jest-expo|" +
      "expo|" +
      "@expo/.*|" +
      "react-navigation|" +
      "@react-navigation/.*|" +
      "@unimodules/.*|" +
      "unimodules|" +
      "sentry-expo|" +
      "native-base|" +
      "react-native-sound-player" +
      ")/) ",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/firebase-functions/"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/navigation/**", // Exclude navigation setup
    "!src/App.tsx", // Exclude main App component
    "!src/types/**", // Exclude type definitions
    "!src/constants/**", // Exclude constants
    "!src/config/**", // Exclude config files
  ],
  coverageReporters: ["json", "lcov", "text", "clover"],
  // Automatically clear mock calls, instances and results before every test
  clearMocks: true,
};
