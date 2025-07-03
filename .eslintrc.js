module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-native/all",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@react-three/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: [
    "react",
    "react-native",
    "@typescript-eslint",
    "react-hooks",
    "@react-three",
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // Add any specific rules or overrides here
    // For example, to disable a rule:
    // '@typescript-eslint/explicit-function-return-type': 'off',
    "react/react-in-jsx-scope": "off", // Not needed with new React versions
    "react-native/no-unused-styles": "warn",
    "react-native/split-platform-components": "warn",
    "react-native/no-inline-styles": "warn",
    "react-native/no-color-literals": "warn",
    "react-native/no-raw-text": "warn",
  },
  overrides: [
    {
      files: [
        "*.cjs",
        "*.config.js",
        "metro.config.js",
        "react-native.config.js",
      ],
      env: {
        node: true,
      },
    },
    {
      files: [
        "**/__tests__/**/*",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/jest.setup.js",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-require-imports": "off",
        "prefer-const": "off",
        "@typescript-eslint/no-empty-object-type": "off",
      },
    },
    {
      files: ["firebase-functions/src/**/*"],
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
      },
    },
  ],
};
