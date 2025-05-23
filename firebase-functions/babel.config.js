module.exports = {
  // This config is intentionally minimal or empty.
  // It exists primarily to prevent Babel (when invoked by Jest or other tools
  // in the context of firebase-functions tests) from traversing upwards and
  // finding the root project's (React Native) babel.config.js.
  // ts-jest is configured with babelConfig: false, so it shouldn't use this for TS files.
  presets: [
    ["@babel/preset-env", {targets: {node: "current"}}],
    // We might need preset-env if Jest processes plain JS files through Babel.
  ],
  plugins: [],
};
