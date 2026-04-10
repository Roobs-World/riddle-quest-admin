module.exports = function (api) {
  api.cache(true);

  const isFirebaseFunctionsTest =
    process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";

  if (isFirebaseFunctionsTest) {
    return {
      presets: [],
      plugins: [],
    };
  }

  return {
    presets: ["babel-preset-expo"],
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
      // Reanimated plugin must be listed last
      "react-native-reanimated/plugin",
    ],
  };
};
