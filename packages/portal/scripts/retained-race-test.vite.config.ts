import {fileURLToPath} from "node:url";
import {createWebTargetViteConfig} from "../webTargetViteConfig.ts";

/** Test artifact output remains outside the canonical provider directories. */
const output = process.env.RETAINED_RACE_BUILD_DIR;
if (!output) throw new Error("Retained test artifact requires an explicit isolated output directory");
/** Standard Jest dependencies and provider build boundaries remain enforced. */
const config = createWebTargetViteConfig({command: "build", mode: "jest", environment: {...process.env, JEST_BUILD_OUT_DIR: output}});
config.root = fileURLToPath(new URL("../", import.meta.url));
config.plugins = [{
  name: "retained-race-test-only-injection",
  enforce: "pre",
  /** Replace only the default test surface; the current host and controller remain real. */
  transform(code: string, id: string) {
    if (!id.endsWith("/play/GameFrameApp.tsx")) return;
    if (!code.includes("  raceSurface,")) throw new Error("Retained race test injection seam changed");
    return {code: `import {RetainedRaceHarness} from ${JSON.stringify(fileURLToPath(new URL("./fixtures/RetainedRaceHarness.tsx", import.meta.url)))};\n` +
      code.replace("  raceSurface,", "  raceSurface = RetainedRaceHarness,"), map: null};
  },
}, ...(config.plugins ?? [])];
export default config;
