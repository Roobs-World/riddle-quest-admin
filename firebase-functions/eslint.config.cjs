const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const globals = require("globals");
const path = require("node:path");
const repositoryRoot = path.resolve(__dirname, "..");

module.exports = [
  {
    ignores: ["firebase-functions/lib/**/*", "firebase-functions/generated/**/*", "firebase-functions/.build-source/**/*"],
  },
  js.configs.recommended,
  ...tseslint.configs["flat/recommended"],
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      quotes: ["error", "double", {avoidEscape: true}],
      "block-spacing": "off",
      "brace-style": "off",
      indent: "off",
      "linebreak-style": "off",
      "max-len": "off",
      "operator-linebreak": "off",
      "preserve-caught-error": "off",
      "valid-jsdoc": "off",
      "require-jsdoc": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["platforms/**/server/scripts/**/*.js"],
    languageOptions: {sourceType: "commonjs"},
    rules: {"@typescript-eslint/no-require-imports": "off"},
  },
  {
    files: ["firebase-functions/src/**/*.ts", "platforms/**/server/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["firebase-functions/src/__tests__/**/*.ts", "firebase-functions/src/**/*.test.ts", "firebase-functions/src/**/*.spec.ts", "platforms/**/server/__tests__/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: false,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "padded-blocks": "off",
      quotes: "off",
    },
  },
].map((entry) => ({...entry, basePath: repositoryRoot}));
