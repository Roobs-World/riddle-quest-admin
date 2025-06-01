// eslint-disable-next-line no-undef
module.exports = {
  // Multi-project configuration for both React Native and Firebase Functions
  projects: [
    {
      // React Native tests configuration
      displayName: "React Native",
      testEnvironment: "node",
      preset: undefined, // Don't use any preset
      setupFiles: ["<rootDir>/jest.setup.react-native.js"],
      setupFilesAfterEnv: ["<rootDir>/__mocks__/jest.setup.js"],
      testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{test,spec}.{js,ts,tsx}",
        "<rootDir>/src/**/*.{test,spec}.{js,ts,tsx}",
      ],
      testPathIgnorePatterns: [
        "/node_modules/",
        "/firebase-functions/",
        "\\.snap$",
      ],
      transform: {
        "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
      },
      transformIgnorePatterns: [
        "node_modules/(?!(jest-)?(@react-native|react-native|@react-native-community|@react-navigation|expo|expo-.*|@expo|react-native-.*|@react-native-.*|@testing-library/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-native-firebase|react-native-vector-icons|react-native-fbsdk-next|@react-native-google-signin|react-native-haptic-feedback|react-native-iap|react-native-image-picker|react-native-applovin-max|nativewind|react-native-css-interop|@react-native-async-storage|unimodules|@unimodules|sentry-expo|react-native-svg-charts)/)",
      ],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@images/(.*)$": "<rootDir>/assets/images/$1",
        "^@fonts/(.*)$": "<rootDir>/assets/fonts/$1",
        "\\.svg$": "<rootDir>/__mocks__/svgMock.js",
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
          "<rootDir>/__mocks__/fileMock.js",
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      coverageDirectory: "<rootDir>/coverage/react-native",
      collectCoverageFrom: [
        "src/**/*.{js,ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/*.test.{js,ts,tsx}",
        "!src/**/*.spec.{js,ts,tsx}",
        "!src/**/__tests__/**",
        "!src/**/index.ts",
      ],
      cacheDirectory: "<rootDir>/.jest-cache/react-native",
      roots: ["<rootDir>/src"],
      globals: {
        __DEV__: true,
      },
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
    },
    {
      // Firebase Functions tests configuration
      displayName: "Firebase Functions",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/firebase-functions/jest.env.setup.js"],
      testMatch: [
        "<rootDir>/firebase-functions/**/__tests__/**/*.{test,spec}.{js,ts}",
        "<rootDir>/firebase-functions/**/*.{test,spec}.{js,ts}",
      ],
      testPathIgnorePatterns: [
        "/node_modules/",
        "/lib/",
        "\\.snap$",
        "\\.it\\.test\\.", // Exclude integration tests by default
      ],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          {
            tsconfig: "<rootDir>/firebase-functions/tsconfig.json",
          },
        ],
      },
      moduleNameMapper: {},
      moduleFileExtensions: ["ts", "js", "json", "node"],
      coverageDirectory: "<rootDir>/coverage/firebase-functions",
      collectCoverageFrom: [
        "firebase-functions/src/**/*.{js,ts}",
        "!firebase-functions/src/**/*.d.ts",
        "!firebase-functions/src/**/*.test.{js,ts}",
        "!firebase-functions/src/**/*.spec.{js,ts}",
        "!firebase-functions/src/index.ts",
      ],
      cacheDirectory: "<rootDir>/.jest-cache/firebase-functions",
      roots: ["<rootDir>/firebase-functions/src"],
      testEnvironmentOptions: {
        // Set environment variable to indicate we're running in a Firebase Functions test environment
        env: {
          IS_FIREBASE_FUNCTIONS_TEST: "true",
        },
      },
    },
  ],
  // Shared Jest settings
  testTimeout: 30000,
  coverageReporters: ["json", "lcov", "text", "html"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  maxWorkers: "50%",
  reporters: ["default"],
  // Combined coverage directory
  collectCoverageFrom: [
    "src/**/*.{js,ts,tsx}",
    "firebase-functions/src/**/*.{js,ts}",
    "!**/*.d.ts",
    "!**/*.test.{js,ts,tsx}",
    "!**/*.spec.{js,ts,tsx}",
    "!**/__tests__/**",
  ],
};
