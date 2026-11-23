import {lstat, readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const defaultSourceDirectory = fileURLToPath(new URL("../../src/", import.meta.url));
const functionsDirectory = fileURLToPath(new URL("../..", import.meta.url));
const stagedDirectory = path.join(functionsDirectory, ".build-source");
const compilerOptions = Object.freeze({
  allowJs: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
});

/** Error raised when production modules form one or more runtime dependency cycles. */
export class ModuleCycleAuditError extends Error {
  /** Cyclic strongly connected modules, expressed relative to the audited source directory. */
  cycles;

  /** Creates a deterministic module-cycle failure. */
  constructor(cycles) {
    super(
      `Production module cycle audit failed with ${cycles.length} cycle(s):\n` +
      cycles.map((cycle) => `- ${cycle.join(" -> ")}`).join("\n"),
    );
    this.name = "ModuleCycleAuditError";
    this.cycles = Object.freeze(cycles.map((cycle) => Object.freeze([...cycle])));
  }
}

const compareText = (left, right) => left.localeCompare(right, "en");
const toPortablePath = (value) => value.split(path.sep).join("/");
const isProductionModule = (name) =>
  /\.(?:[cm]?js|tsx?)$/u.test(name) &&
  !/\.d\.ts$/u.test(name) &&
  !/\.(?:test|spec)\.(?:[cm]?js|tsx?)$/u.test(name);

const collectProductionModules = async (sourceDirectory) => {
  if ((await lstat(sourceDirectory)).isFile()) return [sourceDirectory];
  const modules = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, {withFileTypes: true});
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      const metadata = await lstat(candidate);
      if (metadata.isSymbolicLink()) {
        throw new TypeError(`Production source graph must not contain symbolic links: ${candidate}`);
      }
      if (metadata.isDirectory()) {
        if (entry.name !== "__tests__" && entry.name !== "__mocks__" && entry.name !== "scripts") await walk(candidate);
      } else if (metadata.isFile() && isProductionModule(entry.name)) {
        modules.push(candidate);
      }
    }
  };
  await walk(sourceDirectory);
  modules.sort(compareText);
  return modules;
};

/** Uses the compiler's reachable deployment graph instead of scanning unrelated feature code. */
function collectDeploymentModules() {
  const filename = path.join(functionsDirectory, "tsconfig.json");
  const loaded = ts.readConfigFile(filename, ts.sys.readFile);
  if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(loaded.config, ts.sys, functionsDirectory);
  if (!config.fileNames.length) throw new Error("Prepare deployment source before auditing module cycles.");
  const program = ts.createProgram(config.fileNames, {...config.options, noEmit: true});
  return program.getSourceFiles()
    .map(source => path.resolve(source.fileName))
    .filter(filename => filename.startsWith(`${stagedDirectory}${path.sep}`) && isProductionModule(filename))
    .sort(compareText);
}

const literalModuleName = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

const importClauseHasRuntimeBinding = (clause) => {
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings?.elements.some((element) => !element.isTypeOnly) ?? false;
};

const exportDeclarationHasRuntimeBinding = (declaration) => {
  if (declaration.isTypeOnly) return false;
  if (!declaration.exportClause || ts.isNamespaceExport(declaration.exportClause)) return true;
  return declaration.exportClause.elements.some((element) => !element.isTypeOnly);
};

const collectRuntimeReferences = (sourceFile) => {
  const references = [];
  const add = (node) => {
    const specifier = literalModuleName(node);
    if (specifier !== undefined) references.push(specifier);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && importClauseHasRuntimeBinding(node.importClause)) {
      add(node.moduleSpecifier);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      exportDeclarationHasRuntimeBinding(node)
    ) {
      add(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
};

const findCyclicComponents = (graph) => {
  let nextIndex = 0;
  const index = new Map();
  const lowLink = new Map();
  const active = new Set();
  const stack = [];
  const cycles = [];

  const visit = (module) => {
    index.set(module, nextIndex);
    lowLink.set(module, nextIndex);
    nextIndex += 1;
    stack.push(module);
    active.add(module);

    for (const dependency of graph.get(module)) {
      if (!index.has(dependency)) {
        visit(dependency);
        lowLink.set(module, Math.min(lowLink.get(module), lowLink.get(dependency)));
      } else if (active.has(dependency)) {
        lowLink.set(module, Math.min(lowLink.get(module), index.get(dependency)));
      }
    }

    if (lowLink.get(module) !== index.get(module)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      active.delete(current);
      component.push(current);
    } while (current !== module);
    component.sort(compareText);
    if (component.length > 1 || graph.get(component[0]).includes(component[0])) cycles.push(component);
  };

  for (const module of [...graph.keys()].sort(compareText)) if (!index.has(module)) visit(module);
  cycles.sort((left, right) => compareText(left[0], right[0]));
  return cycles;
};

/**
 * Audits the production Functions source graph for runtime module cycles.
 *
 * Type-only imports are deliberately excluded because they are erased before
 * the CommonJS deployment artifact initializes.
 */
export async function auditProductionModuleCycles({sourceDirectory = defaultSourceDirectory} = {}) {
  if (typeof sourceDirectory !== "string" || sourceDirectory.trim() === "") {
    throw new TypeError("sourceDirectory must be a non-empty string");
  }
  const root = path.resolve(sourceDirectory);
  const deployment = root === path.resolve(defaultSourceDirectory);
  const modules = deployment ? collectDeploymentModules() : await collectProductionModules(root);
  const moduleSet = new Set(modules);
  const resolutionCache = ts.createModuleResolutionCache(root, (value) => value, compilerOptions);
  const graph = new Map(modules.map((module) => [module, []]));
  let referencesChecked = 0;

  for (const module of modules) {
    const source = await readFile(module, "utf8");
    const sourceFile = ts.createSourceFile(module, source, ts.ScriptTarget.Latest, true);
    for (const specifier of collectRuntimeReferences(sourceFile)) {
      referencesChecked += 1;
      const resolved = ts.resolveModuleName(
        specifier,
        module,
        compilerOptions,
        ts.sys,
        resolutionCache,
      ).resolvedModule?.resolvedFileName;
      if (resolved && moduleSet.has(path.resolve(resolved))) graph.get(module).push(path.resolve(resolved));
    }
    graph.get(module).sort(compareText);
  }

  const cycles = findCyclicComponents(graph).map((component) =>
    component.map((module) => toPortablePath(path.relative(deployment ? stagedDirectory : root, module)))
  );
  if (cycles.length > 0) throw new ModuleCycleAuditError(cycles);
  return Object.freeze({modulesScanned: modules.length, referencesChecked, sourceDirectory: root});
}

const invokedAsCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsCli) {
  try {
    const report = await auditProductionModuleCycles();
    process.stdout.write(
      `Production module cycle audit passed ` +
      `(${report.modulesScanned} modules, ${report.referencesChecked} runtime references).\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
