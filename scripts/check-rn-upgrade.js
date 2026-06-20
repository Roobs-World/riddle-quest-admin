const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const nvmrcPath = path.join(projectRoot, ".nvmrc");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const requiredDeps = {
  "react-native": "0.85.3",
  expo: "56.0.12",
  "react-native-reanimated": "4.3.1",
  "react-native-worklets": "0.8.3",
};

const requiredDevDeps = {
  "@react-native/jest-preset": "0.85.3",
  "jest-expo": "56.0.5",
};

const bannedPatterns = [
  {
    label: "StyleSheet.absoluteFillObject",
    regex: /StyleSheet\.absoluteFillObject/g,
  },
  {
    label: "AccessibilityInfo.setAccessibilityFocus",
    regex: /AccessibilityInfo\.setAccessibilityFocus/g,
  },
];

function assertVersion(map, fieldName, pkg, expected) {
  const actual = map[pkg];
  if (actual !== expected) {
    throw new Error(`${fieldName}.${pkg} is "${actual ?? "missing"}", expected "${expected}".`);
  }
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
}

function run() {
  const nodeEngine = packageJson.engines?.node;
  const expectedNodeVersion = typeof nodeEngine === "string" && nodeEngine.startsWith(">=")
    ? nodeEngine.slice(2).trim()
    : null;

  if (!expectedNodeVersion) {
    throw new Error(`Unable to derive expected Node version from engines.node "${nodeEngine ?? "missing"}".`);
  }

  const nvmrcVersion = fs.readFileSync(nvmrcPath, "utf8").trim();
  if (nvmrcVersion !== expectedNodeVersion) {
    throw new Error(`.nvmrc is "${nvmrcVersion}", expected "${expectedNodeVersion}" to match package.json engines.node.`);
  }

  for (const [pkg, version] of Object.entries(requiredDeps)) {
    assertVersion(packageJson.dependencies || {}, "dependencies", pkg, version);
  }
  for (const [pkg, version] of Object.entries(requiredDevDeps)) {
    assertVersion(packageJson.devDependencies || {}, "devDependencies", pkg, version);
  }

  const sourceFiles = [];
  walk(path.join(projectRoot, "src"), sourceFiles);
  sourceFiles.push(path.join(projectRoot, "jest.config.js"));

  const violations = [];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of bannedPatterns) {
      if (pattern.regex.test(content)) {
        violations.push(`${pattern.label} found in ${path.relative(projectRoot, file)}`);
      }
      pattern.regex.lastIndex = 0;
    }
  }

  const jestConfig = fs.readFileSync(path.join(projectRoot, "jest.config.js"), "utf8");
  if (!jestConfig.includes("@react-native/jest-preset")) {
    violations.push("Jest config does not use @react-native/jest-preset.");
  }

  if (violations.length > 0) {
    throw new Error(`RN upgrade checks failed:\n- ${violations.join("\n- ")}`);
  }

  console.log("RN 0.85 Expo SDK 56 alignment checks passed.");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
