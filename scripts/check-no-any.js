#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rootsToScan = ["App.tsx", "src", "firebase-functions/src"];
const extensions = new Set([".ts", ".tsx"]);
const ignoredPathParts = new Set(["node_modules", "lib", "coverage", "__mocks__", "__tests__"]);

const explicitAnyPatterns = [
  /:\s*any\b/g,
  /=\s*any\b/g,
  /\bas\s+any\b/g,
  /\bextends\s+any\b/g,
  /<\s*any\s*>/g,
  /\bArray\s*<\s*any\s*>/g,
  /\bPromise\s*<\s*any\s*>/g,
  /\bRecord\s*<[^>]*,\s*any\s*>/g,
];

function blankOutNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length))
    .replace(/\/\/.*$/gm, (match) => " ".repeat(match.length))
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, (match) => " ".repeat(match.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (match) => " ".repeat(match.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (match) => " ".repeat(match.length));
}

function shouldScan(filePath) {
  const parts = filePath.split(path.sep);
  const basename = path.basename(filePath);

  return (
    extensions.has(path.extname(filePath)) &&
    !/\.test\.[tj]sx?$/.test(basename) &&
    !/\.spec\.[tj]sx?$/.test(basename) &&
    !parts.some((part) => ignoredPathParts.has(part))
  );
}

function collectFiles(targetPath) {
  const absolutePath = path.join(rootDir, targetPath);

  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) {
    return shouldScan(absolutePath) ? [absolutePath] : [];
  }

  return fs.readdirSync(absolutePath, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      return ignoredPathParts.has(entry.name) ? [] : collectFiles(path.relative(rootDir, entryPath));
    }

    return shouldScan(entryPath) ? [entryPath] : [];
  });
}

function lineAndColumnFor(source, index) {
  const beforeMatch = source.slice(0, index);
  const lines = beforeMatch.split(/\r?\n/);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function main() {
  const violations = rootsToScan.flatMap(collectFiles).flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    const searchableSource = blankOutNonCode(source);

    return explicitAnyPatterns.flatMap((pattern) => {
      const matches = [];
      let match;

      while ((match = pattern.exec(searchableSource)) !== null) {
        const location = lineAndColumnFor(source, match.index);
        matches.push({
          filePath,
          line: location.line,
          column: location.column,
          text: source.slice(match.index, match.index + match[0].length).trim(),
        });
      }

      pattern.lastIndex = 0;
      return matches;
    });
  });

  if (violations.length === 0) {
    console.log("No explicit any types found.");
    return;
  }

  console.error("Explicit any types are not allowed. Use a precise type or unknown.");
  for (const violation of violations) {
    const relativePath = path.relative(rootDir, violation.filePath);
    console.error(`${relativePath}:${violation.line}:${violation.column} ${violation.text}`);
  }

  process.exit(1);
}

main();
