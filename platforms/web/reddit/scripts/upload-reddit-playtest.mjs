import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {runRedditPlaytestAttempt, validateRedditPlaytestVersion} from "./reddit-playtest-state.mjs";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));

/** Uploads one explicitly numbered private playtest without automatic version bumps or retries. */
export function uploadRedditPlaytest(args, run = spawnSync, receiptsDirectory = path.join(packageDirectory, "build/.reddit-release-receipts")) {
  const [version] = args;
  if (
    args.length !== 1 ||
    typeof version !== "string"
  ) {
    throw new Error("Supply one explicit prerelease version: pnpm --filter @riddle-quest/reddit-app playtest:upload <major.minor.patch.prerelease>");
  }
  validateRedditPlaytestVersion(version);
  const options = {cwd: packageDirectory, stdio: "inherit"};
  runRedditPlaytestAttempt({directory: receiptsDirectory, version,
    validate() {
      const validation = run("pnpm", ["build:package"], options);
      if (validation.error || validation.status !== 0) throw new Error("Reddit package validation failed; nothing uploaded", {cause: validation.error});
    },
    transmit() {
      const result = run("pnpm", ["exec", "devvit", "upload", "--version", version], options);
      if (result.error || result.status !== 0) {
        throw new Error(`Reddit upload did not confirm success; inspect riddle-quest@${version} before retrying`, {cause: result.error});
      }
    },
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    uploadRedditPlaytest(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
