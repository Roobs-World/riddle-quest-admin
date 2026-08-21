#!/usr/bin/env node
import {fileURLToPath} from "node:url";
import path from "node:path";
import {
  formatPlatformReleasePlan,
  listPlatformReleasePlans,
  runPlatformRelease,
} from "./platform-releases.mjs";

const usage = () => [
  "Riddle Quest platform releases",
  "",
  "  pnpm release:jest [--dry-run]",
  "  pnpm release:youtube [--dry-run]",
  "  pnpm release:reddit [--dry-run]",
  "  pnpm release:plan",
  "",
  "There is no combined release command: every target keeps its own artifact and external boundary.",
].join("\n");

/** Runs the release command-line interface. */
export async function main(args = process.argv.slice(2), log = console.log) {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]))) {
    log(usage());
    return;
  }
  if (args.length === 1 && args[0] === "--list") {
    log(listPlatformReleasePlans().map(formatPlatformReleasePlan).join("\n\n"));
    return;
  }
  const [target, ...options] = args;
  const dryRun = options.length === 1 && options[0] === "--dry-run";
  if (options.length > 0 && !dryRun) {
    throw new Error(`Unsupported release arguments: ${options.join(" ")}`);
  }
  await runPlatformRelease(target, {dryRun, log});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = Number.isSafeInteger(error?.exitCode) ? error.exitCode : 1;
  });
}
