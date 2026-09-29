import {webBuildFacts} from "../../scripts/release/release-registry.mjs";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import type {Plugin} from "vite";
import {createNotice} from "./scripts/generate-third-party-licenses.mjs";
/** Provider source ownership follows the registered integrated targets. */
const owners = new Set(Object.keys(webBuildFacts));

/** Resolves a package name from both ordinary and pnpm module paths. */
export function runtimePackage(id: string): string | null {
  /** Provides suffix behavior. */
  const suffix = id.replaceAll("\\", "/").split("/node_modules/").at(-1);
  if (!suffix || suffix === id.replaceAll("\\", "/")) return null;
  /** Provides segments behavior. */
  const segments = suffix.split("/");
  return segments[0]?.startsWith("@") ? `${segments[0]}/${segments[1]}` : (segments[0] ?? null);
}
/** Rejects a resolved transitive import independently of names in minified code. */
export function assertTargetDependency(target: string, id: string): void {
  /** Provides allowed behavior. */
  const allowed = webBuildFacts[target]?.runtimePackages;
  if (!allowed) throw new Error(`Unknown dependency target: ${target}`);
  /** Provides portable behavior. */
  const portable = id.replaceAll("\\", "/");
  /** Provides owner behavior. */
  const owner = portable.match(/\/packages\/portal\/src\/([^/]+)\//)?.[1];
  if (owner && owners.has(owner) && owner !== target) {
    throw new Error(`${target} artifact contains ${owner}-owned module: ${id}`);
  }
  /** Provides name behavior. */
  const name = runtimePackage(id);
  if (
    name &&
    !allowed.some((pattern) =>
      pattern.endsWith("/*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
    )
  ) {
    throw new Error(`${target} artifact contains undeclared runtime package ${name}: ${id}`);
  }
  if (/\/(?:__tests__|test)\/|\.(?:test|spec)\.[cm]?[jt]sx?(?:\?|$)/u.test(portable)) {
    throw new Error(`${target} artifact contains test code: ${id}`);
  }
}
/** Resolves evidence without allowing a custom artifact to replace its canonical release inventory. */
export function targetDependencyEvidencePath(target: string, outputDirectory: string, evidenceDirectory?: string): string {
  /** Repository containing the canonical Web Target outputs. */
  const repository = fileURLToPath(new URL("../..", import.meta.url));
  /** Registered artifact facts, required even for custom output directories. */
  const facts = webBuildFacts[target];
  if (!facts) throw new Error(`Unknown dependency target: ${target}`);
  /** Shared evidence root; inventories never enter shipped files. */
  const directory = evidenceDirectory ?? path.join(repository, "artifacts", "target-dependencies");
  /** Absolute output identity used by both naming and inventory validation. */
  const output = path.resolve(outputDirectory);
  if (output === path.join(repository, "packages", "portal", facts.outputDirectory)) {
    return path.join(directory, `${target}.json`);
  }
  /** Custom builds for the same target retain independent inventories. */
  const key = createHash("sha256").update(output).digest("hex");
  return path.join(directory, "custom", key, `${target}.json`);
}
/** Audits every emitted entry/lazy chunk and records an inventory outside shipped files. */
export function webTargetDependencyPlugin(
  target: string,
  options: {
    /** Stores evidence directory. */
    evidenceDirectory?: string;
  } = {},
): Plugin {
  /** Actual artifact directory selected by Vite. */
  let outputDirectory = "";
  /** Inventory selected after the build configuration is resolved. */
  let evidenceFile = "";
  /** Serialized module evidence stays private until written artifact bytes are verified. */
  let pendingInventory: string | undefined;
  /** Only a completed write stage can publish dependency evidence. */
  let written = false;
  /** Repository used to record portable module paths. */
  const repository = fileURLToPath(new URL("../..", import.meta.url));
  return {
    name: "riddle-quest-target-dependencies",
    apply: "build",
    enforce: "post",
    /** Captures the selected artifact and its independent inventory path. */
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
      evidenceFile = targetDependencyEvidencePath(target, outputDirectory, options.evidenceDirectory);
    },
    /** Invalidates only this output's evidence and resets reused build state. */
    buildStart() {
      written = false;
      pendingInventory = undefined;
      rmSync(evidenceFile, {force: true});
    },
    /** Checks resolved modules before tree shaking can hide an invalid import. */
    moduleParsed(info) {
      assertTargetDependency(target, info.id);
    },
    /** Verifies minification-independent chunk membership, including dynamic entries. */
    generateBundle(_options, bundle) {
      /** Every emitted script, including lazy entries. */
      const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
      /** Resolved source membership of the emitted artifact. */
      const modules = [...new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules)))].sort();
      for (const id of modules) assertTargetDependency(target, id);
      /** Runtime packages that need target-specific license notices. */
      const packages = [...new Set(modules.map(runtimePackage).filter((name): name is string => name !== null))].sort();
      /** License text contains only packages in this artifact. */
      const notice = createNotice(new Set(packages), {includeHomepages: target !== "youtube"});
      this.emitFile({type: "asset", fileName: "third-party-licenses.txt", source: notice});
      pendingInventory = JSON.stringify({
        schemaVersion: 1,
        target,
        outputDirectory,
        packages,
        modules: modules.map((id) => path.relative(repository, id).replaceAll("\\", "/")),
        chunks: chunks.map((chunk) => ({
          file: chunk.fileName,
          entry: chunk.isEntry,
          dynamicEntry: chunk.isDynamicEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          sha256: createHash("sha256").update(chunk.code).digest("hex"),
        })),
      });
    },
    /** Marks writing complete after earlier write hooks succeed; generate-only builds emit no inventory. */
    writeBundle: {
      order: "post",
      sequential: true,
      /** Records completion without publishing partially verified evidence. */
      handler() {
        written = true;
      },
    },
    /** Binds evidence to final bytes after postprocessing, including private source-map cleanup. */
    closeBundle: {
      order: "post",
      sequential: true,
      /** Publishes one complete inventory, or leaves this output without successful evidence. */
      handler() {
        if (!written || !pendingInventory) return;
        try {
          /** Bundle graph retained in memory until the write stage completed. */
          const evidence = JSON.parse(pendingInventory);
          for (const chunk of evidence.chunks) {
            chunk.sha256 = createHash("sha256").update(readFileSync(path.join(outputDirectory, chunk.file))).digest("hex");
          }
          /** Files whose runtime graph was actually inspected by the bundler. */
          const emitted = new Set(evidence.chunks.map((chunk: {
            /** Emitted script path relative to the artifact root. */
            file: string;
          }) => chunk.file));
          /** All final files, including copied public assets. */
          const files = readdirSync(outputDirectory, {recursive: true, withFileTypes: true})
            .filter((entry) => entry.isFile())
            .map((entry) => path.relative(outputDirectory, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
            .sort();
          for (const name of files) {
            if (name.endsWith(".map") || (/\.[cm]?js$/u.test(name) && !emitted.has(name))) {
              throw new Error(`${target} artifact contains untracked copied script: ${name}`);
            }
          }
          evidence.files = files.map((name) => ({
            file: name,
            sha256: createHash("sha256").update(readFileSync(path.join(outputDirectory, name))).digest("hex"),
          }));
          mkdirSync(path.dirname(evidenceFile), {recursive: true});
          writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + "\n");
        } catch (error) {
          rmSync(evidenceFile, {force: true});
          throw error;
        }
      },
    },
  };
}
