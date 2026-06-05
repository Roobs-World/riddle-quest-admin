"use strict";

/**
 * Repo-wide hardcoded text scanner for user-facing source under src/**.
 *
 * This check blocks untranslated or hardcoded UI copy outside src/locales/**,
 * while allowing logging text, translation-key plumbing, QA metadata, and
 * other clearly non-user-facing constants that should not be localized.
 */

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const isJsonMode = process.argv.includes("--json");

const excludedPathSegments = [
  `${path.sep}locales${path.sep}`,
  `${path.sep}qa${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}__mocks__${path.sep}`,
  `${path.sep}mocks${path.sep}`,
  `${path.sep}snapshots${path.sep}`,
  `${path.sep}generated${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}coverage${path.sep}`,
  `${path.sep}types${path.sep}`,
  `${path.sep}constants${path.sep}achievements.ts`,
  `${path.sep}services${path.sep}ProductPricingService.ts`,
  `${path.sep}services${path.sep}IapService.ts`,
];

const uiAttributeNames = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "aria-label",
  "ariaLabel",
  "body",
  "button",
  "caption",
  "description",
  "error",
  "header",
  "hint",
  "label",
  "message",
  "notice",
  "placeholder",
  "prompt",
  "shareText",
  "subtitle",
  "text",
  "title",
  "tooltip",
]);

const uiPropertyNames = new Set([
  "body",
  "button",
  "caption",
  "description",
  "error",
  "header",
  "hint",
  "label",
  "message",
  "notice",
  "placeholder",
  "prompt",
  "shareText",
  "subtitle",
  "text",
  "title",
  "tooltip",
]);

const safeLiterals = new Set([
  "OK",
  "X",
  "bs://",
]);

const specialMessageFilePatterns = [
  `${path.sep}src${path.sep}application${path.sep}auth${path.sep}authErrorMessages.ts`,
  `${path.sep}src${path.sep}application${path.sep}errors${path.sep}cloudFunctionErrorMessages.ts`,
  `${path.sep}src${path.sep}application${path.sep}modals${path.sep}ModalCommandBus.ts`,
  `${path.sep}src${path.sep}services${path.sep}SocialSharingService.ts`,
  `${path.sep}src${path.sep}utils${path.sep}riddleClues.ts`,
  `${path.sep}src${path.sep}qa${path.sep}qaSurfaces.ts`,
];

const uiCallNamePatterns = [
  /(^|\.)(alert|announceForAccessibility|share|showAlert|showInfo|showError|showWarning|toast)$/u,
];

const loggingCallPatterns = [
  /(^|\.)(console|logger|log|warn|error|debug|trace|info|verbose|success|failure|group|dir|assert)$/u,
  /sentry/u,
  /capture/u,
];

function listSourceFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, {withFileTypes: true});
  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (excludedPathSegments.some((segment) => fullPath.includes(segment))) {
      return [];
    }

    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    if (!/\.(c|m)?(t|j)sx?$/u.test(entry.name) || entry.name.endsWith(".d.ts")) {
      return [];
    }

    return [fullPath];
  });
}

function getLineAndColumn(source, index) {
  const before = source.slice(0, index).split(/\r?\n/u);
  return {
    line: before.length,
    column: before[before.length - 1].length + 1,
  };
}

function isSafeCodeLikeLiteral(value) {
  if (safeLiterals.has(value)) {
    return true;
  }

  if (/^https?:\/\//u.test(value) || /^mailto:/u.test(value) || /^tel:/u.test(value)) {
    return true;
  }

  if (/^[a-z0-9._/-]+$/u.test(value) && !/\s/u.test(value)) {
    return true;
  }

  if (/^[A-Z0-9_]+$/u.test(value)) {
    return true;
  }

  if (/^[a-z0-9-: ]+$/u.test(value) && /[-: ]/u.test(value)) {
    return true;
  }

  if (/^rgba?\(/u.test(value)) {
    return true;
  }

  if (/^#[A-Za-z0-9_]+$/u.test(value) && value.length < 40) {
    return true;
  }

  return false;
}

function isProbablyUserFacing(value, context) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (isSafeCodeLikeLiteral(trimmed)) {
    return false;
  }

  if (/[\s\n\r\t]/u.test(trimmed)) {
    return true;
  }

  if (/[\p{L}]/u.test(trimmed) && trimmed.length <= 30) {
    return context.isUiContext || context.isUiCall;
  }

  return false;
}

function getCalleeName(node) {
  if (!node) {
    return "";
  }

  if (node.type === "Identifier") {
    return node.name;
  }

  if (node.type === "MemberExpression" && !node.computed) {
    const objectName = getCalleeName(node.object);
    const propertyName = getCalleeName(node.property);
    return objectName ? `${objectName}.${propertyName}` : propertyName;
  }

  return "";
}

function getPropertyName(node) {
  if (!node) {
    return "";
  }

  if (node.type === "Identifier") {
    return node.name;
  }

  if (node.type === "StringLiteral") {
    return node.value;
  }

  return "";
}

function hasAncestor(node, predicate) {
  let current = node.parentPath;
  while (current) {
    if (predicate(current)) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

function collectFindings(filePath, source) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "dynamicImport",
      "optionalChaining",
      "nullishCoalescingOperator",
      "objectRestSpread",
      "topLevelAwait",
    ],
    errorRecovery: true,
  });

  const findings = [];

  traverse(ast, {
    JSXText(nodePath) {
      const text = nodePath.node.value.replace(/\s+/gu, " ").trim();
      if (!text) {
        return;
      }

      if (!/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(text)) {
        return;
      }

      findings.push({
        line: nodePath.node.loc?.start.line ?? getLineAndColumn(source, nodePath.node.start ?? 0).line,
        snippet: text,
        reason: "JSX text",
      });
    },
    StringLiteral(nodePath) {
      const value = nodePath.node.value;
      const context = getContext(nodePath);
      if (context.isLoggingCall) {
        return;
      }
      if (isMessageArrayLiteral(nodePath)) {
        return;
      }
      if (isDiagnosticPatternLiteral(nodePath)) {
        return;
      }
      if (isTranslationKeyArgument(nodePath)) {
        return;
      }
      const specialFile = specialMessageFilePatterns.some((segment) => filePath.includes(segment));
      if (!specialFile && !context.isUiContext && !context.isUiCall) {
        return;
      }

      if (!isProbablyUserFacing(value, context)) {
        return;
      }

      findings.push({
        line: nodePath.node.loc?.start.line ?? getLineAndColumn(source, nodePath.node.start ?? 0).line,
        snippet: value,
        reason: getReason(nodePath),
      });
    },
    TemplateLiteral(nodePath) {
      if (nodePath.node.expressions.length > 0) {
        return;
      }

      const value = nodePath.node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
      const context = getContext(nodePath);
      if (context.isLoggingCall) {
        return;
      }
      if (isMessageArrayLiteral(nodePath)) {
        return;
      }
      if (isDiagnosticPatternLiteral(nodePath)) {
        return;
      }
      if (isTranslationKeyArgument(nodePath)) {
        return;
      }
      const specialFile = specialMessageFilePatterns.some((segment) => filePath.includes(segment));
      if (!specialFile && !context.isUiContext && !context.isUiCall) {
        return;
      }

      if (!isProbablyUserFacing(value, context)) {
        return;
      }

      findings.push({
        line: nodePath.node.loc?.start.line ?? getLineAndColumn(source, nodePath.node.start ?? 0).line,
        snippet: value,
        reason: getReason(nodePath),
      });
    },
  });

  return findings;
}

function getContext(nodePath) {
  const uiAttribute = hasAncestor(nodePath, (ancestor) => {
    if (ancestor.node?.type !== "JSXAttribute") {
      return false;
    }

    const name = getPropertyName(ancestor.node.name);
    return uiAttributeNames.has(name);
  });

  const uiProperty = hasAncestor(nodePath, (ancestor) => {
    if (ancestor.node?.type !== "ObjectProperty") {
      return false;
    }

    const keyName = getPropertyName(ancestor.node.key);
    return uiPropertyNames.has(keyName);
  });

  const uiCall = hasAncestor(nodePath, (ancestor) => {
    if (ancestor.node?.type !== "CallExpression") {
      return false;
    }

    const calleeName = getCalleeName(ancestor.node.callee);
    return uiCallNamePatterns.some((pattern) => pattern.test(calleeName));
  });

  const loggingCall = hasAncestor(nodePath, (ancestor) => {
    if (ancestor.node?.type !== "CallExpression") {
      return false;
    }

    const calleeName = getCalleeName(ancestor.node.callee);
    return loggingCallPatterns.some((pattern) => pattern.test(calleeName));
  });

  return {
    isUiContext: uiAttribute || uiProperty || uiCall,
    isUiCall: uiCall && !loggingCall,
    isLoggingCall: loggingCall,
  };
}

function isTranslationKeyArgument(nodePath) {
  const callExpression = nodePath.parentPath;
  if (!callExpression || callExpression.node?.type !== "CallExpression") {
    return false;
  }

  const calleeName = getCalleeName(callExpression.node.callee);
  if (calleeName === "t" || calleeName === "translate") {
    return callExpression.node.arguments[0] === nodePath.node;
  }

  return false;
}

function isMessageArrayLiteral(nodePath) {
  const arrayExpression = nodePath.parentPath;
  if (!arrayExpression || arrayExpression.node?.type !== "ArrayExpression") {
    return false;
  }

  const variableDeclarator = arrayExpression.parentPath;
  if (!variableDeclarator || variableDeclarator.node?.type !== "VariableDeclarator") {
    return false;
  }

  const identifier = variableDeclarator.node.id;
  if (!identifier || identifier.type !== "Identifier") {
    return false;
  }

  return /(_MESSAGES|_CODES)$/u.test(identifier.name);
}

function isDiagnosticPatternLiteral(nodePath) {
  let current = nodePath.parentPath;

  while (current) {
    if (current.node?.type === "CallExpression") {
      const calleeName = getCalleeName(current.node.callee);
      if (calleeName === "createMessageContainsStrategy") {
        return true;
      }
    }

    current = current.parentPath;
  }

  return false;
}

function getReason(nodePath) {
  if (hasAncestor(nodePath, (ancestor) => ancestor.node?.type === "JSXAttribute")) {
    return "UI prop";
  }

  if (hasAncestor(nodePath, (ancestor) => ancestor.node?.type === "JSXElement")) {
    return "JSX";
  }

  if (hasAncestor(nodePath, (ancestor) => ancestor.node?.type === "CallExpression")) {
    return "call argument";
  }

  return "string literal";
}

function main() {
  const files = listSourceFiles(srcDir);
  const findings = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const fileFindings = collectFindings(filePath, source).map((finding) => ({
      file: path.relative(rootDir, filePath).replace(/\\/gu, "/"),
      ...finding,
    }));
    findings.push(...fileFindings);
  }

  if (isJsonMode) {
    console.log(JSON.stringify({totalFindings: findings.length, findings}, null, 2));
    if (findings.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (findings.length === 0) {
    console.log("Hardcoded text check passed: no user-facing raw copy found outside locale catalogs.");
    return;
  }

  console.error(`Hardcoded text check found ${findings.length} potential user-facing strings outside src/locales/**.`);
  for (const finding of findings.slice(0, 200)) {
    console.error(`${finding.file}:${finding.line} [${finding.reason}] ${finding.snippet}`);
  }

  if (findings.length > 200) {
    console.error(`...and ${findings.length - 200} more.`);
  }

  process.exitCode = 1;
}

if (require.main === module) {
  main();
}
