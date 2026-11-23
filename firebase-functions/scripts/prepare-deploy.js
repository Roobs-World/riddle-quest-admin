const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");
const {stagePlatformSource} = require("./stage-platform-source.js");

const repoRoot = path.resolve(__dirname, "..", "..");
const sourceCoreDir = path.join(repoRoot, "packages", "core");
const targetCoreDir = path.join(__dirname, "..", "packages", "core");
const functionsNodeModulesDir = path.join(__dirname, "..", "node_modules");

function copyBuildArtifact(source, target) {
  fs.copyFileSync(path.join(source, "package.json"), path.join(target, "package.json"));
  fs.cpSync(path.join(source, "dist"), path.join(target, "dist"), {
    recursive: true,
    force: true,
    dereference: true,
  });
}

function assertCopiedArtifactIsComplete(target) {
  const requiredFiles = [
    path.join(target, "dist", "validation", "firestoreSchemas.js"),
    path.join(target, "dist", "validation", "firestoreSchemas.d.ts"),
    path.join(target, "dist", "validation", "index.js"),
    path.join(target, "dist", "race", "index.js"),
    path.join(target, "dist", "race", "index.d.ts"),
    path.join(target, "dist", "index.js"),
  ];

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required deploy artifact: ${filePath}`);
    }
  }
}

function syncInstalledPackageCopy(targetCorePackageDir) {
  const installedPackageLink = path.join(functionsNodeModulesDir, "@riddle-quest", "core");
  const packageDirs = new Set();
  if (fs.existsSync(installedPackageLink)) {
    packageDirs.add(fs.realpathSync(installedPackageLink));
  }

  const pnpmDir = path.join(functionsNodeModulesDir, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, {withFileTypes: true})) {
      if (!entry.isDirectory() || !entry.name.startsWith("@riddle-quest+core@file+")) {
        continue;
      }
      const candidate = path.join(pnpmDir, entry.name, "node_modules", "@riddle-quest", "core");
      if (fs.existsSync(candidate)) {
        packageDirs.add(fs.realpathSync(candidate));
      }
    }
  }

  for (const installedCoreDir of packageDirs) {
    fs.copyFileSync(path.join(targetCorePackageDir, "package.json"), path.join(installedCoreDir, "package.json"));
    fs.cpSync(path.join(targetCorePackageDir, "dist"), path.join(installedCoreDir, "dist"), {
      recursive: true,
      force: true,
      dereference: true,
    });
  }
}

execSync("pnpm --filter @riddle-quest/core build", {
  cwd: repoRoot,
  stdio: "inherit",
});

fs.rmSync(targetCoreDir, {recursive: true, force: true});
fs.mkdirSync(targetCoreDir, {recursive: true});
fs.mkdirSync(path.dirname(targetCoreDir), {recursive: true});

copyBuildArtifact(sourceCoreDir, targetCoreDir);
assertCopiedArtifactIsComplete(targetCoreDir);
syncInstalledPackageCopy(targetCoreDir);

console.log(`Prepared deploy build artifact at ${targetCoreDir}`);

stagePlatformSource();
