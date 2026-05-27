module.exports = {
  // This config is for Firebase Functions Jest tests that need Babel transformation
  // ts-jest handles most TypeScript files, but this provides fallback support
  presets: [
    ["@babel/preset-env", {targets: {node: "current"}}],
    [
      "@babel/preset-typescript",
      {
        allowNamespaces: true,
        allowDeclareFields: true,
      },
    ],
  ],
  plugins: [
    ["@babel/plugin-proposal-decorators", {legacy: true}],
    ["@babel/plugin-transform-class-properties", {loose: true}],
  ],
};
