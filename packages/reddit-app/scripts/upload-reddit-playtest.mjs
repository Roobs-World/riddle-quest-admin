import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));

/** Uploads one explicitly numbered private playtest without automatic version bumps or retries. */
export function uploadRedditPlaytest(args, run = spawnSync) {
  const [version] = args;
  if (
    args.length !== 1 ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.[1-9]\d*$/u.test(version ?? "") ||
    !version.split(".").every((part) => Number.isSafeInteger(Number(part)))
  ) {
    throw new Error("Supply one explicit prerelease version: pnpm --filter @qwordly/reddit-app playtest:upload <major.minor.patch.prerelease>");
  }
  const options = {cwd: packageDirectory, stdio: "inherit"};
  const validation = run("pnpm", ["build:package"], options);
  if (validation.error || validation.status !== 0) throw new Error("Reddit package validation failed; nothing uploaded", {cause: validation.error});
  const result = run("pnpm", ["exec", "devvit", "upload", "--version", version], options);
  if (result.error || result.status !== 0) {
    throw new Error(`Reddit upload did not confirm success; inspect riddle-quest@${version} before retrying`, {cause: result.error});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    uploadRedditPlaytest(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
