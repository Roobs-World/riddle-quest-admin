import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import type {Plugin} from "vite";

/** Provides facebook artifact plugin behavior. */
export function facebookArtifactPlugin(): Plugin {
  /** One source manifest supplies both provider review configuration and build-time consistency checks. */
  const source = readFileSync(fileURLToPath(new URL("../fbapp-config.json", import.meta.url)), "utf8");
  /** Only configured native update identifiers may be enabled by the client artifact. */
  const templates = JSON.parse(source).instant_games.custom_update_templates;
  return {
    name: "riddle-quest-facebook-artifact",
    /** Rejects environment overrides that refer to an undeclared provider template. */
    configResolved(config) {
      /** Vite's resolved environment includes both mode-file defaults and explicit build overrides. */
      const template = config.env.VITE_FACEBOOK_CONTEXT_CHALLENGE_TEMPLATE;
      if (template && (!/^[A-Za-z0-9_-]{1,128}$/u.test(template) || !Object.hasOwn(templates, template)))
        throw new Error("Facebook context challenge template must be declared in fbapp-config.json");
    },
    /** Provides generate bundle behavior. */
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "fbapp-config.json",
        // Keep the accepted platform/navigation values and review templates in the target's source manifest.
        source,
      });
    },
  };
}
