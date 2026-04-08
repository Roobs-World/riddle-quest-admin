#!/usr/bin/env node
/**
 * Pre-commit hook: runs lint and full test suite before allowing commits.
 * Commit is blocked if any step fails.
 * Emergency bypass: git commit --no-verify (use sparingly)
 */

const { spawnSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function run(cmd, args, cwd = rootDir) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  return result.status;
}

function main() {
  const skipLint = process.env.PRE_COMMIT_SKIP_LINT === "1";

  console.log("🔍 Running pre-commit checks...\n");

  if (!skipLint) {
    console.log("📋 Step 1/3: Linting...");
    if (run("pnpm", ["run", "lint"]) !== 0) {
      console.error("\n❌ Lint failed. Fix errors before committing.");
      process.exit(1);
    }
    console.log("✅ Lint passed\n");
  } else {
    console.log("⏭️  Skipping lint (PRE_COMMIT_SKIP_LINT=1)\n");
  }

  console.log("📱 Step 2/3: React Native tests...");
  if (run("pnpm", ["run", "test"]) !== 0) {
    console.error("\n❌ React Native tests failed. Fix tests before committing.");
    process.exit(1);
  }
  console.log("✅ React Native tests passed\n");

  console.log("☁️  Step 3/3: Firebase Functions tests...");
  if (run("pnpm", ["run", "test"], path.join(rootDir, "firebase-functions")) !== 0) {
    console.error("\n❌ Firebase Functions tests failed. Fix tests before committing.");
    process.exit(1);
  }
  console.log("✅ Firebase Functions tests passed\n");

  console.log("🎉 All pre-commit checks passed!");
}

main();
