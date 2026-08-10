const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const globals = require("globals");

module.exports = [
  {
    ignores: ["lib/**/*", "generated/**/*"],
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
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["src/__tests__/**/*.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
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
];
