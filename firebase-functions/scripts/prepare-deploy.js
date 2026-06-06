const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const sourceCoreDir = path.join(repoRoot, "packages", "core");
const targetCoreDir = path.join(__dirname, "..", "packages", "core");

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
    path.join(target, "dist", "index.js"),
  ];

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required deploy artifact: ${filePath}`);
    }
  }
}

execSync("pnpm --filter @qwordly/core build", {
  cwd: repoRoot,
  stdio: "inherit",
});

fs.rmSync(targetCoreDir, {recursive: true, force: true});
fs.mkdirSync(targetCoreDir, {recursive: true});
fs.mkdirSync(path.dirname(targetCoreDir), {recursive: true});

copyBuildArtifact(sourceCoreDir, targetCoreDir);
assertCopiedArtifactIsComplete(targetCoreDir);

console.log(`Prepared deploy build artifact at ${targetCoreDir}`);
