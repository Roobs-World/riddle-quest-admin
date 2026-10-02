import {protectContent} from "@qwordly/core/contentProtection";
import {readFileSync} from "node:fs";
import type {Plugin} from "vite";

/** Entry alias for the self-contained content envelope and local pack loaders. */
export const playableContentModule = "virtual:playable-content";

/** Resolved module prefix for answer-bearing locale payloads. */
const packPrefix = "virtual:playable-pack-";

/** Splits audited bundled content by locale without introducing remote data calls. */
export function playableContentPlugin(contentPath: string): Plugin {
  /** Development uses the source document so edits retain normal Vite HMR. */
  let building = false;
  return {
    name: "riddle-quest-playable-content",
    /** Selects the production asset emission path. */
    configResolved(config) { building = config.command === "build"; },
    /** Resolves only this plugin's generated entry. */
    resolveId(id) { return id === playableContentModule || id.startsWith(packPrefix) ? `\0${id}` : null; },
    /** Emits a small envelope and one separately addressable module per locale. */
    async load(id) {
      if (id !== `\0${playableContentModule}` && !id.startsWith(`\0${packPrefix}`)) return null;
      this.addWatchFile(contentPath);
      /** Selected release or explicit engineering content document. */
      const source = readFileSync(contentPath, "utf8");
      if (!building) return `export default ${source};`;
      /** Separates locale payloads from shared schema and scheduling metadata. */
      const {packs, ...envelope} = JSON.parse(source) as {
        /** Locale payloads shipped alongside the entry. */
        packs: Record<string, unknown>;
        /** Shared content metadata. */
        [key: string]: unknown;
      };
      if (id.startsWith(`\0${packPrefix}`)) {
        /** Locale selected by an emitted chunk entry. */
        const locale = id.slice(`\0${packPrefix}`.length);
        if (!Object.hasOwn(packs, locale)) throw new Error(`playable-content-pack-missing:${locale}`);
        return `export default ${JSON.stringify(await protectContent(packs[locale]))};`;
      }
      /** Emitted local URLs permit retrying a failed module download with a fresh URL. */
      const loaders = Object.keys(packs).map(locale => {
        /** Asset reference resolved relative to the entry by the bundler. */
        const reference = this.emitFile({type: "chunk", id: `${packPrefix}${locale}`, name: `playable-pack-${locale}`, preserveSignature: "strict"});
        return `${JSON.stringify(locale)}:loader(import.meta.ROLLUP_FILE_URL_${reference})`;
      }).join(",");
      return `
        import {readProtectedContent} from "@qwordly/core/contentProtection";
        function loader(url) {
          let attempt = 0, pending;
          return () => pending ??= import(/* @vite-ignore */ attempt ? url + '?retry=' + attempt : url)
            .then(module => readProtectedContent(module.default))
            .catch(error => { pending = undefined; attempt++; throw error; });
        }
        export default {...${JSON.stringify(envelope)},loadPack:{${loaders}}};
      `;
    },
  };
}
