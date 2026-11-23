// Functions contract checks import browser-facing source with bundler syntax.
const {createHash} = require("node:crypto");
const ts = require("typescript");

/** Compiler options for workspace client sources imported by functions tests. */
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
  /** Transpiles one workspace client module to CommonJS without type checking. */
  process(source, filename) {
    return {code: ts.transpileModule(source, {fileName: filename, compilerOptions}).outputText};
  },
};
