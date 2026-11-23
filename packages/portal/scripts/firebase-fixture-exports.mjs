import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";

/** Collects the real runtime namespace without initializing Firebase or its SDKs. */
export function collectFirebaseFixtureExports({adapterSource, firebaseModulePath}) {
  const adapter = ts.createSourceFile("firebase-fixture-adapter.ts", adapterSource, ts.ScriptTarget.Latest, true);
  const names = new Set();
  let namespace = false;
  let imported = false;
  for (const statement of adapter.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "../firebase" || !statement.importClause || statement.importClause.isTypeOnly) continue;
    const clause = statement.importClause;
    assert.ok(!clause.name, "Firebase fixture default imports need an explicit default-export seam");
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      namespace = true;
      imported = true;
    } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) if (!element.isTypeOnly) {
        names.add((element.propertyName ?? element.name).text);
        imported = true;
      }
    }
  }
  assert.ok(imported, "Firebase fixture adapter has no supported runtime Firebase import");
  if (namespace) {
    const filename = path.resolve(firebaseModulePath);
    const program = ts.createProgram([filename], {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, noLib: true, skipLibCheck: true, types: []});
    const source = program.getSourceFile(filename);
    assert.ok(source, "Firebase fixture module source is unavailable");
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(source);
    assert.ok(symbol, "Firebase fixture source must be a module");
    for (const property of checker.getPropertiesOfType(checker.getTypeOfSymbolAtLocation(symbol, source))) names.add(property.name);
  }
  for (const name of names) assert.ok(name !== "default" && ts.isIdentifierText(name, ts.ScriptTarget.Latest),
    `Firebase fixture cannot declare runtime export ${JSON.stringify(name)}`);
  assert.ok(names.size > 0, "Firebase fixture runtime namespace is empty");
  return [...names];
}
