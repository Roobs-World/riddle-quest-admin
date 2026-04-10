// eslint-disable-next-line no-undef
module.exports = function (api) {
  api.cache.using(
    () =>
      `${process.env.NODE_ENV || ""}|${process.env.BABEL_ENV || ""}|${
        process.env.JEST_WORKER_ID ? "1" : "0"
      }`
  );

  // Check for the Jest global variable
  const isFirebaseFunctionsTest =
    process.env.IS_FIREBASE_FUNCTIONS_TEST === "true";

  // Check if we're in a Jest test environment.
  // NOTE: __DEV__ exists in normal React Native runtime, so it is not a Jest signal.
  const isJestTest =
    process.env.NODE_ENV === "test" ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.BABEL_ENV === "test";
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
      isJestTest
        ? "module:@react-native/babel-preset"
        : [
            "babel-preset-expo",
            {
              disableStaticViewConfigsCodegen: true,
              jsxRuntime: "classic",
              enableBabelRuntime: false,
            },
          ],
    ],
    plugins: ["@babel/plugin-transform-export-namespace-from"],
    overrides: [],
  };

  baseConfig.plugins.push(function stripDeprecatedJsxDebugProps() {
    return {
      name: "strip-deprecated-jsx-debug-props",
      visitor: {
        JSXOpeningElement(path, state) {
          const filename = state?.filename || "";
          const skipCodegenSensitiveFile =
            filename.endsWith("VirtualViewNativeComponent.js") ||
            filename.endsWith("VirtualViewExperimentalNativeComponent.js");
          if (skipCodegenSensitiveFile) return;

          path.node.attributes = path.node.attributes.filter((attr) => {
            if (!attr || attr.type !== "JSXAttribute") return true;
            if (attr.name?.type !== "JSXIdentifier") return true;
            return attr.name.name !== "__self" && attr.name.name !== "__source";
          });
        },
      },
    };
  });

  baseConfig.overrides.push({
    test: (filename) => {
      if (!filename) return true;
      return !filename.includes("node_modules");
    },
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
  });

  return baseConfig;
};
