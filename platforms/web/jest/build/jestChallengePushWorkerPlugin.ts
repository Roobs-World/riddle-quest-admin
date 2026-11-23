import path from "node:path";
import {fileURLToPath} from "node:url";
import type {Plugin, ConfigEnv} from "vite";

/** Resolves a target-owned worker URL without bypassing the production dependency graph. */
export function jestChallengePushWorkerPlugin(target: string, command: ConfigEnv["command"]): Plugin {
  /** Repository containing the target-owned script. */
  const repository = fileURLToPath(new URL("../../../..", import.meta.url));
  return {
    name: "riddle-quest-jest-challenge-push-worker",
    enforce: "pre",
    /** Emits the notification worker through the same inspected graph as game scripts. */
    resolveId(id, importer) {
      /** Only the exact target-owned URL import receives worker-entry handling. */
      const owned = Boolean(importer && id.endsWith("?url") &&
        path.resolve(path.dirname(importer.split("?")[0]), id.slice(0, -4)) ===
          path.join(repository, "platforms/web/jest/src/notifications/liveChallengePushWorker.js"));
      if (id !== "virtual:jest-live-challenge-push-worker-url" && !owned) return null;
      if (target !== "jest") throw new Error(`${target} artifact cannot emit the Jest notification worker`);
      return "\0virtual:jest-live-challenge-push-worker-url";
    },
    /** A real worker entry avoids data URLs and untracked copied JavaScript assets. */
    load(id) {
      if (id !== "\0virtual:jest-live-challenge-push-worker-url") return null;
      if (command === "serve") return 'export default "/src/notifications/liveChallengePushWorker.js";';
      /** Rollup retains this entry in dependency evidence and emits its HTTPS-compatible URL. */
      const reference = this.emitFile({type: "chunk", name: "liveChallengePushWorker",
        id: path.join(repository, "platforms/web/jest/src/notifications/liveChallengePushWorker.js")});
      return `export default import.meta.ROLLUP_FILE_URL_${reference};`;
    },
  };
}
