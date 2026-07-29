module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    projectService: true,
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    quotes: ["error", "double", {avoidEscape: true}],
    "block-spacing": "off",
    "brace-style": "off",
    "import/no-unresolved": 0,
    indent: "off",
    "linebreak-style": "off",
    "max-len": "off",
    "operator-linebreak": "off",
    "valid-jsdoc": "off",
    "require-jsdoc": "off",
    "@typescript-eslint/no-explicit-any": "error",
  },
  overrides: [
    {
      files: ["src/__tests__/**/*.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
      parserOptions: {
        projectService: false,
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "padded-blocks": "off",
        quotes: "off",
      },
    },
  ],
};
