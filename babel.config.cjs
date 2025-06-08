// eslint-disable-next-line no-undef
module.exports = function (api) {
  // Use cache.using() to prevent duplicate configuration errors
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
    // This ensures ts-jest handles everything and no React Native presets are loaded.
    return {
      presets: [], // No presets from here
      plugins: [], // No plugins from here
    };
  }

  // For Jest tests, avoid nativewind/babel to prevent CSS interop issues
  const presets = isJestTest
    ? ["babel-preset-expo"]
    : [
        ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        "nativewind/babel",
      ];

  // React Native config with TypeScript support
  return {
    presets,
    plugins: [
      "@babel/plugin-transform-flow-strip-types",
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
