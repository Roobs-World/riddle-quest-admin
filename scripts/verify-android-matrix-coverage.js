#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

const readFile = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const readJson = (relativePath) => JSON.parse(readFile(relativePath));

const createSourceFile = (relativePath) =>
  ts.createSourceFile(
    relativePath,
    readFile(relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const isExported = (node) => Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));

const unwrapExpression = (node) => {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression;
  }
  return current;
};

const findExportedVariableInitializer = (sourceFile, variableName) => {
  let initializer = null;

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node) || !isExported(node)) {
      return;
    }

    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) {
        initializer = declaration.initializer;
      }
    }
  });

  if (!initializer) {
    throw new Error(`Could not find exported variable ${variableName}.`);
  }

  return unwrapExpression(initializer);
};

const propertyNameText = (name) => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
};

const stringLiteralValue = (node) => {
  const expression = unwrapExpression(node);
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) ? expression.text : null;
};

const getObjectPropertyString = (objectLiteral, propertyName) => {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    if (propertyNameText(property.name) !== propertyName) {
      continue;
    }
    return stringLiteralValue(property.initializer);
  }
  return null;
};

const extractSurfaceIdsFromArray = (sourceFile, variableName) => {
  const initializer = findExportedVariableInitializer(sourceFile, variableName);
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(`${variableName} is not an array literal.`);
  }

  return initializer.elements.map((element) => {
    const objectLiteral = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(objectLiteral)) {
      throw new Error(`${variableName} contains a non-object surface entry.`);
    }

    const id = getObjectPropertyString(objectLiteral, "id");
    if (!id) {
      throw new Error(`${variableName} contains a surface without a string id.`);
    }
    return id;
  });
};

const extractStringArray = (sourceFile, variableName) => {
  const initializer = findExportedVariableInitializer(sourceFile, variableName);
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(`${variableName} is not an array literal.`);
  }

  return initializer.elements.map((element) => {
    const value = stringLiteralValue(element);
    if (!value) {
      throw new Error(`${variableName} contains a non-string entry.`);
    }
    return value;
  });
};

const extractStringObject = (sourceFile, variableName) => {
  const initializer = findExportedVariableInitializer(sourceFile, variableName);
  if (!ts.isObjectLiteralExpression(initializer)) {
    throw new Error(`${variableName} is not an object literal.`);
  }

  const entries = {};
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = propertyNameText(property.name);
    const value = stringLiteralValue(property.initializer);
    if (!key || !value) {
      throw new Error(`${variableName} contains a non-string entry.`);
    }
    entries[key] = value;
  }
  return entries;
};

const extractObjectKeys = (sourceFile, variableName) => {
  const initializer = findExportedVariableInitializer(sourceFile, variableName);
  if (!ts.isObjectLiteralExpression(initializer)) {
    throw new Error(`${variableName} is not an object literal.`);
  }

  return initializer.properties.map((property) => {
    if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property)) {
      throw new Error(`${variableName} contains an unsupported property.`);
    }
    const key = propertyNameText(property.name);
    if (!key) {
      throw new Error(`${variableName} contains a non-literal key.`);
    }
    return key;
  });
};

const sorted = (values) => [...values].sort();

const difference = (left, right) => {
  const rightSet = new Set(right);
  return sorted(left.filter((value) => !rightSet.has(value)));
};

const assertSameSet = (label, left, right, failures) => {
  const missing = difference(right, left);
  const extra = difference(left, right);

  if (missing.length > 0 || extra.length > 0) {
    failures.push(`${label} mismatch. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`);
  }
};

const extractPowerShellExpectedTextKeys = () => {
  const script = readFile("scripts/android-emulator-run-matrix.ps1");
  const match = script.match(/\$QASurfaceExpectedTexts\s*=\s*@\{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error("Could not find $QASurfaceExpectedTexts in matrix script.");
  }

  return [...match[1].matchAll(/^\s*"([^"]+)"\s*=/gm)].map((keyMatch) => keyMatch[1]);
};

const extractAvdNames = () => {
  const script = readFile("scripts/android-emulator-run-matrix.ps1");
  const match = script.match(/\[string\[\]\]\$AvdNames\s*=\s*@\(([\s\S]*?)\)\s*,/);
  if (!match) {
    throw new Error("Could not find Android AVD matrix in matrix script.");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((avdMatch) => avdMatch[1]);
};

const collectCoverageData = () => {
  const qaSurfacesSource = createSourceFile("src/qa/qaSurfaces.ts");
  const harnessSource = createSourceFile("src/qa/QASurfaceHarness.tsx");
  const modalTypesSource = createSourceFile("src/components/modals/modalTypes.ts");

  const pageSurfaceIds = extractSurfaceIdsFromArray(qaSurfacesSource, "QA_PAGE_SURFACES");
  const registryModalSurfaceIds = extractSurfaceIdsFromArray(qaSurfacesSource, "QA_REGISTRY_MODAL_SURFACES");
  const modalVariantSurfaceIds = extractSurfaceIdsFromArray(qaSurfacesSource, "QA_MODAL_VARIANT_SURFACES");
  const standaloneModalSurfaceIds = extractSurfaceIdsFromArray(qaSurfacesSource, "QA_STANDALONE_MODAL_SURFACES");
  const popupSurfaceIds = extractSurfaceIdsFromArray(qaSurfacesSource, "QA_POPUP_SURFACES");

  return {
    pageSurfaceIds,
    registryModalSurfaceIds,
    modalVariantSurfaceIds,
    standaloneModalSurfaceIds,
    popupSurfaceIds,
    surfaceIds: [
      ...pageSurfaceIds,
      ...registryModalSurfaceIds,
      ...modalVariantSurfaceIds,
      ...standaloneModalSurfaceIds,
      ...popupSurfaceIds,
    ],
    modalRegistryTypes: extractStringArray(modalTypesSource, "MODAL_REGISTRY_TYPES"),
    modalSurfaceMap: extractStringObject(qaSurfacesSource, "QA_MODAL_SURFACE_TO_REGISTRY_TYPE"),
    rendererKeys: extractObjectKeys(harnessSource, "QA_SURFACE_RENDERERS"),
    expectedTextKeys: extractPowerShellExpectedTextKeys(),
    avdNames: extractAvdNames(),
  };
};

const verifyCoverage = () => {
  const failures = [];
  const data = collectCoverageData();
  const packageJson = readJson("package.json");
  const matrixScript = packageJson.scripts?.["test:android:matrix"] ?? "";
  const unitScript = packageJson.scripts?.["test:android:matrix:unit"] ?? "";

  const duplicateSurfaceIds = sorted(
    data.surfaceIds.filter((surfaceId, index) => data.surfaceIds.indexOf(surfaceId) !== index),
  );
  if (duplicateSurfaceIds.length > 0) {
    failures.push(`Duplicate QA surface id(s): ${duplicateSurfaceIds.join(", ")}.`);
  }

  if (data.avdNames.length < 8) {
    failures.push(`Android matrix should cover every configured device; found only ${data.avdNames.length} AVD(s).`);
  }

  if (!matrixScript.includes("test:android:matrix:coverage")) {
    failures.push("test:android:matrix must run test:android:matrix:coverage before emulator work.");
  }

  if (matrixScript.includes("SkipQASurfaceScreenshots")) {
    failures.push("test:android:matrix must not skip QA surface screenshots.");
  }

  if (!unitScript.includes("--testPathPatterns=src")) {
    failures.push("test:android:matrix:unit must run the full src test suite.");
  }

  assertSameSet("QA surface renderers", data.rendererKeys, data.surfaceIds, failures);

  assertSameSet("QA surface expected text checks", data.expectedTextKeys, data.surfaceIds, failures);

  assertSameSet(
    "QA modal surface mapping keys",
    Object.keys(data.modalSurfaceMap),
    [...data.registryModalSurfaceIds, ...data.modalVariantSurfaceIds],
    failures,
  );

  const baseMappedModalTypes = data.registryModalSurfaceIds.map((surfaceId) => data.modalSurfaceMap[surfaceId]);
  assertSameSet("registered modal screenshot coverage", baseMappedModalTypes, data.modalRegistryTypes, failures);

  if (data.popupSurfaceIds.length === 0) {
    failures.push("QA popup screenshot coverage must include at least one popup surface.");
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL: ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS: Android matrix coverage includes ${data.surfaceIds.length} QA surfaces across ${data.avdNames.length} AVDs.`,
  );
};

const command = process.argv[2] ?? "--verify";

try {
  if (command === "--ids") {
    process.stdout.write(`${JSON.stringify(collectCoverageData().surfaceIds)}\n`);
  } else if (command === "--verify") {
    verifyCoverage();
  } else {
    console.error("Usage: node scripts/verify-android-matrix-coverage.js [--verify|--ids]");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
