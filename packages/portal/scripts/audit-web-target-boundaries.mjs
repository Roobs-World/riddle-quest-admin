import {lstat, readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const defaultSourceDirectory = fileURLToPath(new URL("../src", import.meta.url));
const targetOwners = new Set(["jest", "facebook", "reddit", "youtube"]);
const sharedOwner = "shared";
const externalOwner = "external";
const compilerOptions = Object.freeze({
  allowImportingTsExtensions: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolveJsonModule: true,
});

class WebTargetBoundaryAuditError extends Error {
  constructor(violations) {
    const details = violations.map((violation) =>
      `${violation.file}:${violation.line}:${violation.column} [${violation.code}] ${violation.message}`
    );
    super(`Web Target import boundary audit failed with ${violations.length} violation(s):\n${details.join("\n")}`);
    this.name = "WebTargetBoundaryAuditError";
    this.violations = Object.freeze(violations);
  }
}

const compareText = (left, right) => left.localeCompare(right, "en");
const toPortablePath = (file) => file.split(path.sep).join("/");
const isProductionSourceFile = (name) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".test.");

const classifyPath = (sourceDirectory, candidate) => {
  const relative = path.relative(sourceDirectory, path.resolve(candidate));
  if (relative === "" || relative === ".") return sharedOwner;
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return externalOwner;
  }
  const [firstSegment] = relative.split(path.sep);
  return targetOwners.has(firstSegment) ? firstSegment : sharedOwner;
};

const collectProductionSources = async (sourceDirectory) => {
  const rootMetadata = await lstat(sourceDirectory);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new TypeError(`Web Target source root must be a real directory: ${sourceDirectory}`);
  }

  const files = [];
  const walk = async (directory, relativeSegments) => {
    const entries = await readdir(directory, {withFileTypes: true});
    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) {
        throw new TypeError(`Web Target source tree must not contain symbolic links: ${absolute}`);
      }
      if (metadata.isDirectory()) {
        if (entry.name === "__tests__") continue;
        if (relativeSegments.length === 0 && entry.name === "test") continue;
        await walk(absolute, [...relativeSegments, entry.name]);
        continue;
      }
      if (!metadata.isFile()) {
        throw new TypeError(`Web Target source tree contains a non-regular entry: ${absolute}`);
      }
      if (isProductionSourceFile(entry.name)) files.push(absolute);
    }
  };

  await walk(sourceDirectory, []);
  files.sort(compareText);
  return files;
};

const literalText = (node) => {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text;
  }
  return undefined;
};

const collectModuleReferences = (sourceFile) => {
  const references = [];
  const addReference = (node, specifierNode, syntax) => {
    references.push(Object.freeze({
      node,
      specifier: literalText(specifierNode),
      syntax,
    }));
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      addReference(node, node.moduleSpecifier, node.importClause?.isTypeOnly ? "import type" : "import");
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      addReference(node, node.moduleSpecifier, node.isTypeOnly ? "export type" : "re-export");
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addReference(node, node.moduleReference.expression, "import equals require");
    } else if (ts.isImportTypeNode(node)) {
      const specifierNode = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      addReference(node, specifierNode, "import type expression");
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addReference(node, node.arguments[0], "dynamic import");
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      addReference(node, node.arguments[0], "require");
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
};

const cleanRelativeSpecifier = (specifier) => specifier.replace(/[?#].*$/u, "");
const isRelativeSpecifier = (specifier) =>
  specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
const isLegacyPlatformEntry = (specifier) =>
  specifier === "#platform-entry" || specifier.startsWith("#platform-entry/");
const isDevvitPackage = (specifier) => specifier === "@devvit" || specifier.startsWith("@devvit/");
const isFirebasePackage = (specifier) =>
  specifier === "firebase" || specifier.startsWith("firebase/") ||
  specifier === "@firebase" || specifier.startsWith("@firebase/");
const isSentryPackage = (specifier) => specifier === "@sentry" || specifier.startsWith("@sentry/");

const diagnosticMessage = (diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

/**
 * Audits the production portal source graph as one fail-closed Web Target
 * boundary. The Interface returns only a stable summary; parsing, resolution,
 * ownership classification, and provider policy remain hidden here.
 */
export async function auditWebTargetBoundaries({sourceDirectory = defaultSourceDirectory} = {}) {
  if (typeof sourceDirectory !== "string" || sourceDirectory.trim() === "") {
    throw new TypeError("sourceDirectory must be a non-empty string");
  }

  const root = path.resolve(sourceDirectory);
  const files = await collectProductionSources(root);
  const resolutionCache = ts.createModuleResolutionCache(root, (file) => file, compilerOptions);
  const violations = [];
  let referencesChecked = 0;

  const addViolation = ({code, file, node, owner, sourceFile, specifier, message}) => {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push(Object.freeze({
      code,
      column: location.character + 1,
      file: toPortablePath(path.relative(root, file)),
      line: location.line + 1,
      message,
      owner,
      specifier,
    }));
  };

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
    const owner = classifyPath(root, file);

    for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
      const node = diagnostic.start === undefined
        ? sourceFile
        : {
            getStart: () => diagnostic.start,
          };
      addViolation({
        code: "SOURCE_PARSE_ERROR",
        file,
        node,
        owner,
        sourceFile,
        specifier: undefined,
        message: diagnosticMessage(diagnostic),
      });
    }

    for (const reference of collectModuleReferences(sourceFile)) {
      referencesChecked += 1;
      const {node, specifier, syntax} = reference;
      if (specifier === undefined) {
        addViolation({
          code: "NON_LITERAL_MODULE_REFERENCE",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} must use a string literal so its Web Target boundary can be audited`,
        });
        continue;
      }

      if (isLegacyPlatformEntry(specifier)) {
        addViolation({
          code: "LEGACY_PLATFORM_ENTRY",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} of legacy #platform-entry is forbidden; use an explicit Web Target entry`,
        });
      }

      if (isDevvitPackage(specifier) && owner !== "reddit") {
        addViolation({
          code: "DEVVIT_OUTSIDE_REDDIT",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} of ${specifier} is permitted only in Reddit-owned source`,
        });
      }

      if ((owner === "reddit" || owner === "youtube") && (isFirebasePackage(specifier) || isSentryPackage(specifier))) {
        addViolation({
          code: "FORBIDDEN_PROVIDER_IMPORT",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} of ${specifier} is forbidden in ${owner}-owned source`,
        });
      }

      if (!isRelativeSpecifier(specifier)) continue;
      const cleanSpecifier = cleanRelativeSpecifier(specifier);
      const lexicalPath = path.resolve(path.dirname(file), cleanSpecifier);
      const lexicalOwner = classifyPath(root, lexicalPath);
      const resolution = ts.resolveModuleName(
        cleanSpecifier,
        file,
        compilerOptions,
        ts.sys,
        resolutionCache,
      );
      const resolvedOwner = resolution.resolvedModule
        ? classifyPath(root, resolution.resolvedModule.resolvedFileName)
        : externalOwner;
      const destinationOwner = targetOwners.has(lexicalOwner)
        ? lexicalOwner
        : targetOwners.has(resolvedOwner)
          ? resolvedOwner
          : lexicalOwner;

      if (owner === sharedOwner && targetOwners.has(destinationOwner)) {
        addViolation({
          code: "SHARED_TO_TARGET",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} crosses from shared source into ${destinationOwner}-owned source: ${specifier}`,
        });
      } else if (targetOwners.has(owner) && targetOwners.has(destinationOwner) && owner !== destinationOwner) {
        addViolation({
          code: "CROSS_TARGET_IMPORT",
          file,
          node,
          owner,
          sourceFile,
          specifier,
          message: `${syntax} crosses from ${owner}-owned source into ${destinationOwner}-owned source: ${specifier}`,
        });
      }
    }
  }

  violations.sort((left, right) =>
    compareText(left.file, right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    compareText(left.code, right.code) ||
    compareText(left.specifier ?? "", right.specifier ?? "")
  );
  if (violations.length > 0) throw new WebTargetBoundaryAuditError(violations);

  return Object.freeze({
    filesScanned: files.length,
    referencesChecked,
    sourceDirectory: root,
  });
}

const invokedAsCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsCli) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length > 1 || arguments_.some((argument) => argument.startsWith("-"))) {
    process.stderr.write("Usage: node scripts/audit-web-target-boundaries.mjs [source-directory]\n");
    process.exitCode = 1;
  } else {
    try {
      const report = await auditWebTargetBoundaries(
        arguments_[0] ? {sourceDirectory: arguments_[0]} : undefined,
      );
      process.stdout.write(
        `Web Target boundary audit passed ` +
          `(${report.filesScanned} files, ${report.referencesChecked} module references).\n`,
      );
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
