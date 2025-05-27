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
      [
        "module-resolver",
        {
          alias: {
            "@images": "./assets/images",
            "@fonts": "./assets/fonts",
          },
        },
      ],
      // The following transform plugins might be covered by babel-preset-expo or metro-react-native-babel-preset (which expo's preset wraps)
      // If issues arise, they might need to be re-evaluated or removed if redundant.
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      "react-native-reanimated/plugin", // This should be listed last
    ],
  };
};
