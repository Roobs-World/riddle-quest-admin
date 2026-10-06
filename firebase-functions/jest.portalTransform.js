// ts-jest caches one compiler configuration per Jest project, so a second
// ts-jest entry cannot give portal sources different options. Portal's
// "type": "module" package makes the shared NodeNext config emit ESM, which
// CommonJS tests cannot load; this transpiles those shared files as CommonJS.
const {createHash} = require("node:crypto");
const ts = require("typescript");

/** Compiler options for portal sources imported by functions tests. */
const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  inlineSourceMap: true,
  inlineSources: true,
};

module.exports = {
  /** Keys cached output by source, path and compiler version. */
  getCacheKey(source, filename) {
    return createHash("sha256").update(ts.version).update("\0").update(filename).update("\0").update(source).digest("hex");
  },
  /** Transpiles one portal module to CommonJS without type checking. */
  process(source, filename) {
    return {code: ts.transpileModule(source, {fileName: filename, compilerOptions}).outputText};
  },
};
