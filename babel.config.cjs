// eslint-disable-next-line no-undef
module.exports = function (api) {
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

  // Base configuration for all environments
  const baseConfig = {
    presets: [
      isJestTest ? "module:@react-native/babel-preset" : [
        "babel-preset-expo",
        {
          jsxRuntime: "automatic",
          jsxImportSource: "react-native-css-interop",
          enableDevelopmentTransforms: true,
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
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ],
  };

  // Add NativeWind and Reanimated for non-test environments
  if (!isJestTest) {
    baseConfig.presets.push("nativewind/babel");
    baseConfig.plugins.push("react-native-reanimated/plugin");
  }

  return baseConfig;
};
