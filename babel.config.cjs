// eslint-disable-next-line no-undef
module.exports = function (api) {
  // Use cache.using() to prevent caching conflicts
  api.cache.using(() => process.env.NODE_ENV);

  // Check for the Jest global variable
  const isFirebaseFunctionsTest =
    process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";

  // Check if we're in a Jest test environment
  const isJestTest =
    process.env.NODE_ENV === "test" ||
    (typeof global !== "undefined" && global.hasOwnProperty("__DEV__")) ||
    api.env("test");

  if (isFirebaseFunctionsTest) {
    // Return a minimal config for Firebase Functions tests
    return {
      presets: [],
      plugins: [],
    };
  }

  // For Jest tests, use classic runtime for compatibility
  if (isJestTest) {
    return {
      presets: [
        [
          "babel-preset-expo",
          {
            jsxRuntime: "classic",
            jsxPragma: "React.createElement",
            jsxPragmaFrag: "React.Fragment",
          },
        ],
      ],
      plugins: [
        [
          "module-resolver",
          {
            root: ["./"],
            alias: {
              "@": "./src",
              "@images": "./assets/images",
              "@fonts": "./assets/fonts",
            },
          },
        ],
      ],
    };
  }

  // Production/Development configuration
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          jsxRuntime: "automatic",
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
            "@images": "./assets/images",
            "@fonts": "./assets/fonts",
          },
        },
      ],
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      "react-native-reanimated/plugin", // This should be listed last
    ],
  };
};
