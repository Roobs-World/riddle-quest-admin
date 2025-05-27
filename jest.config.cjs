// eslint-disable-next-line no-undef
module.exports = {
  // Use different configurations for different test patterns
  projects: [
    {
      // React Native tests configuration
      displayName: "React Native",
      testEnvironment: "react-native",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
      transform: {
        "^.+\\.(js|jsx|ts|tsx)$": [
          "babel-jest",
          { configFile: "./babel.config.cjs" },
        ],
      },
      moduleNameMapper: {
        // Asset files should be mapped to fileMock for React Native
        "\\.(mp3|wav|m4a|aac|oga|webm|mp4|mov|avi|mkv|png|jpg|jpeg|gif|webp|svg)$":
          "<rootDir>/__mocks__/fileMock.js",
      },
      testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}",
        "<rootDir>/src/**/*.{test,spec}.{ts,tsx,js,jsx}",
      ],
      collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
      transformIgnorePatterns: [
        "node_modules/(?!(@react-native|react-native|@react-native-community|@react-navigation|@testing-library/react-native|@react-native-firebase|nativewind|zustand|react-native-vector-icons|react-native-haptic-feedback|react-native-gesture-handler|react-native-reanimated|jest-runner|expo)/)",
      ],
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    },
    {
      // Firebase Functions tests configuration
      displayName: "Firebase Functions",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/firebase-functions/jest.env.setup.js"],
      transform: {
        "^.+\\.(js|ts)$": [
          "babel-jest",
          { configFile: "./firebase-functions/babel.config.cjs" },
        ],
      },
      testMatch: [
        "<rootDir>/firebase-functions/src/**/__tests__/**/*.{test,spec}.{ts,js}",
        "<rootDir>/firebase-functions/src/**/*.{test,spec}.{ts,js}",
        "<rootDir>/firebase-functions/src/**/__tests__/**/*.it.{ts,js}",
      ],
      collectCoverageFrom: [
        "firebase-functions/src/**/*.{ts,js}",
        "!firebase-functions/src/**/*.d.ts",
        "!firebase-functions/src/**/__mocks__/**",
        "!firebase-functions/src/**/__tests__/**/testUtils.{ts,js}",
      ],
      moduleFileExtensions: ["ts", "js", "json", "node"],
      roots: ["<rootDir>/firebase-functions"],
      modulePathIgnorePatterns: ["<rootDir>/src/"],
      transformIgnorePatterns: ["node_modules/(?!(firebase-functions-test)/)"],
      globals: {
        IS_FIREBASE_FUNCTIONS_TEST: true,
      },
    },
  ],
  testTimeout: 60000,
};
