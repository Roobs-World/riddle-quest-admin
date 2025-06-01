// eslint-disable-next-line no-undef
module.exports = function (api) {
  api.cache(true);

  // Check for the Jest global variable
  const isFirebaseFunctionsTest =
    process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";

  if (isFirebaseFunctionsTest) {
    // Return a minimal config for Firebase Functions tests
    // This ensures ts-jest handles everything and no React Native presets are loaded.
    return {
      presets: [], // No presets from here
      plugins: [], // No plugins from here
    };
  }

  // React Native config with TypeScript support
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
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
