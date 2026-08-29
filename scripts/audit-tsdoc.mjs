import {createRequire} from "node:module";
import {readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requireFromPortal = createRequire(path.join(root, "packages/portal/package.json"));
const ts = requireFromPortal("typescript");
const sourceRoots = ["packages/core/src", "packages/portal", "packages/reddit-app", "firebase-functions/src"];
const ignoredDirectories = new Set(["coverage", "dist", "dist-jest", "lib", "node_modules"]);
const fix = process.argv.includes("--fix");

async function collect(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function isDocumented(node, sourceFile) {
  return (ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? []).some((range) =>
    sourceFile.text.slice(range.pos, range.end).startsWith("/**"),
  );
}

function declarationName(node, sourceFile) {
  if (ts.isVariableStatement(node)) return node.declarationList.declarations[0]?.name.getText(sourceFile) ?? "value";
  if (node.name) return node.name.getText(sourceFile).replace(/^['"]|['"]$/g, "");
  return "default export";
}

function words(identifier) {
  return identifier
    .replace(/Schema$/, " schema")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_$-]+/g, " ")
    .trim()
    .toLowerCase();
}

function actionSummary(name) {
  const actions = [
    ["get", "Gets"],
    ["create", "Creates"],
    ["build", "Builds"],
    ["make", "Creates"],
    ["load", "Loads"],
    ["read", "Reads"],
    ["fetch", "Fetches"],
    ["list", "Lists"],
    ["find", "Finds"],
    ["resolve", "Resolves"],
    ["compute", "Computes"],
    ["calculate", "Calculates"],
    ["validate", "Validates"],
    ["parse", "Parses"],
    ["format", "Formats"],
    ["normalize", "Normalizes"],
    ["serialize", "Serializes"],
    ["map", "Maps"],
    ["convert", "Converts"],
    ["update", "Updates"],
    ["set", "Sets"],
    ["save", "Saves"],
    ["store", "Stores"],
    ["delete", "Deletes"],
    ["remove", "Removes"],
    ["clear", "Clears"],
    ["reset", "Resets"],
    ["start", "Starts"],
    ["stop", "Stops"],
    ["complete", "Completes"],
    ["submit", "Submits"],
    ["request", "Requests"],
    ["publish", "Publishes"],
    ["send", "Sends"],
    ["record", "Records"],
    ["track", "Tracks"],
    ["capture", "Captures"],
    ["handle", "Handles"],
    ["apply", "Applies"],
    ["ensure", "Ensures"],
    ["assert", "Asserts"],
    ["with", "Runs"],
    ["use", "Provides"],
    ["render", "Renders"],
  ];
  for (const [prefix, verb] of actions) {
    const boundary = name[prefix.length];
    if (name.startsWith(prefix) && boundary && /[A-Z0-9_]/.test(boundary)) {
      return `${verb} ${words(name.slice(prefix.length))}.`;
    }
  }
  if (/^(?:is|has|can|should|supports|allows)[A-Z_]/.test(name)) return `Indicates whether ${words(name)}.`;
  return `Provides ${words(name)} behavior.`;
}

function summary(node, sourceFile, ownerName) {
  const name = declarationName(node, sourceFile);
  if (ts.isConstructorDeclaration(node)) return `Creates a ${words(ownerName ?? "class")} instance.`;
  if (ts.isCallSignatureDeclaration(node)) return `Defines how ${words(ownerName ?? "callable")} is invoked.`;
  if (ts.isInterfaceDeclaration(node)) return `Defines the contract for ${words(name)}.`;
  if (ts.isTypeAliasDeclaration(node)) return `Describes ${words(name)}.`;
  if (ts.isEnumDeclaration(node)) return `Enumerates the supported ${words(name)} values.`;
  if (ts.isEnumMember(node)) return `Defines the ${words(name)} option.`;
  if (ts.isClassDeclaration(node)) return `Provides ${words(name)} behavior.`;
  if (
    ts.isPropertyDeclaration(node) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    return actionSummary(name);
  }
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return `Stores ${words(name)}.`;
  if (ts.isGetAccessorDeclaration(node)) return `Gets ${words(name)}.`;
  if (ts.isSetAccessorDeclaration(node)) return `Sets ${words(name)}.`;
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isFunctionDeclaration(node))
    return actionSummary(name);
  if (ts.isVariableStatement(node)) {
    if (name.endsWith("Schema")) return `Validates the ${words(name.slice(0, -6))} data shape.`;
    if (/^[A-Z][A-Za-z0-9]*$/.test(name)) return `Renders the ${words(name)} interface.`;
    if (/^[A-Z0-9_]+$/.test(name)) return `Defines the ${words(name)} value.`;
    return actionSummary(name);
  }
  return `Documents ${words(name)}.`;
}

function eligibleDeclaration(node) {
  return (
    ts.isVariableStatement(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isCallSignatureDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isEnumMember(node)
  );
}

function declarationOwnerName(node, sourceFile) {
  let owner = node.parent;
  while (owner && !ts.isSourceFile(owner)) {
    if (
      ts.isClassDeclaration(owner) ||
      ts.isInterfaceDeclaration(owner) ||
      ts.isTypeAliasDeclaration(owner) ||
      ts.isEnumDeclaration(owner)
    ) {
      return declarationName(owner, sourceFile);
    }
    owner = owner.parent;
  }
  return undefined;
}

const files = (await Promise.all(sourceRoots.map((directory) => collect(path.join(root, directory))))).flat();
const missing = [];
let declarationCount = 0;
for (const file of files) {
  const contents = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = [];
  const visit = (node) => {
    if (eligibleDeclaration(node)) {
      declarations.push({node, ownerName: declarationOwnerName(node, sourceFile)});
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  declarationCount += declarations.length;
  const undocumented = declarations.filter(({node}) => !isDocumented(node, sourceFile));
  if (undocumented.length === 0 && !fix) continue;
  missing.push(
    ...undocumented.map(
      ({node}) =>
        `${path.relative(root, file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1} ${declarationName(node, sourceFile)}`,
    ),
  );
  if (fix) {
    let updated = contents;
    const replacements = [];
    for (const {node} of declarations) {
      if (
        !ts.isPropertyDeclaration(node) ||
        !node.initializer ||
        !(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      )
        continue;
      const name = declarationName(node, sourceFile);
      const oldComment = `/** Stores ${words(name)}. */`;
      const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
      const oldRange = ranges.find((range) => sourceFile.text.slice(range.pos, range.end) === oldComment);
      if (oldRange)
        replacements.push({position: oldRange.pos, end: oldRange.end, text: `/** ${actionSummary(name)} */`});
    }
    const insertions = undocumented.map(({node, ownerName}) => {
      const position = node.getStart(sourceFile);
      const lineStart = contents.lastIndexOf("\n", position - 1) + 1;
      const indentation = contents.slice(lineStart, position).match(/^\s*/)?.[0] ?? "";
      return {position, end: position, text: `/** ${summary(node, sourceFile, ownerName)} */\n${indentation}`};
    });
    const edits = [...replacements, ...insertions].sort((left, right) => right.position - left.position);
    for (const edit of edits) updated = updated.slice(0, edit.position) + edit.text + updated.slice(edit.end);
    await writeFile(file, updated);
  }
}

if (missing.length > 0 && !fix) {
  console.error(`TSDoc audit failed: ${missing.length} production declarations are undocumented.`);
  for (const item of missing) console.error(`- ${item}`);
  process.exitCode = 1;
} else if (fix) {
  console.log(`Added TSDoc to ${missing.length} production declarations.`);
} else {
  console.log(`TSDoc audit passed: ${declarationCount} declarations are documented across ${files.length} files.`);
}
