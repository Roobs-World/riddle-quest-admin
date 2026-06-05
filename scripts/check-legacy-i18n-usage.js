"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");

const forbiddenFiles = [
  "src/constants/AppStrings.ts",
  "scripts/migrate-legacy-translations.js",
  "scripts/tsconfig.legacy-i18n.json",
];

const importPattern = /from\s+["'][^"']*constants\/AppStrings["']/u;
const appStringsTokenPattern = /\bAppStrings\b/u;

function walk(dirPath, results = []) {
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/u.test(entry.name)) {
      continue;
    }

    if (/(\.test\.|__tests__|generated[\\/]|locales[\\/])/u.test(fullPath)) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function main() {
  const errors = [];

  for (const relativePath of forbiddenFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      errors.push(`Forbidden legacy i18n artifact still exists: ${relativePath}`);
    }
  }

  for (const filePath of walk(srcDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (importPattern.test(source) || appStringsTokenPattern.test(source)) {
      errors.push(`Legacy AppStrings import found in ${path.relative(rootDir, filePath)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  console.log("Legacy i18n usage check passed.");
}

main();
