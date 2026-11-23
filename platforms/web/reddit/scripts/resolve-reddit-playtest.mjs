import path from "node:path";
import {fileURLToPath} from "node:url";
import {resolveRedditPlaytest} from "./reddit-playtest-state.mjs";

/** Records an inspected upload outcome locally; this command never calls Devvit. */
export function resolveRedditPlaytestArgs(args, directory = fileURLToPath(new URL("../.reddit-release-receipts", import.meta.url))) {
  const [version, status, flag, confirmVersion] = args;
  if (args.length !== 4 || flag !== "--confirm-version") {
    throw new Error("Usage: playtest:resolve VERSION accepted|confirmed-absent --confirm-version VERSION");
  }
  return resolveRedditPlaytest({directory, version, status, confirmVersion});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = resolveRedditPlaytestArgs(process.argv.slice(2));
    console.log(`Retained Reddit playtest ${result.version} outcome: ${result.status}; no upload performed`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
