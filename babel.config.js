module.exports = function (api) {
  api.cache(true);

  // Check for the environment variable
  if (process.env.IS_FIREBASE_FUNCTIONS_TEST === "true") {
    // Return a minimal config for Firebase Functions tests
    // This ensures ts-jest handles everything and no React Native presets are loaded.
    return {
      presets: [], // No presets from here
      plugins: [], // No plugins from here
    };
  }

  // Original React Native config
  return {
    presets: [
      [
        "module:metro-react-native-babel-preset",
        { jsxImportSource: "nativewind" },
      ],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      [
        "module-resolver",
        {
          alias: {
            "@images": "./assets/images",
            "@fonts": "./assets/fonts",
          },
        },
      ],
    ],
  };
};
