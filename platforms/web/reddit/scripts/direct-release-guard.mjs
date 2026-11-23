import {fileURLToPath} from "node:url";
import path from "node:path";

const actions = new Set(["upload", "publish"]);

/** Creates the fail-closed error for an unsafe direct Reddit mutation. */
export function directRedditReleaseError(action) {
  if (!actions.has(action)) throw new Error(`Unknown direct Reddit release action: ${action}`);
  return new Error(
    `Direct Reddit ${action} is disabled because Devvit rebuilds or creates a new version. ` +
    "Run `pnpm release:reddit` only to create the immutable candidate; remote release remains blocked " +
    "until an exact-byte adapter or equivalent proof is available.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const action = process.argv[2];
  try {
    throw directRedditReleaseError(action);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
