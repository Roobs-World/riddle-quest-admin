import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {auditWebTargetBoundaries} from "./audit-web-target-boundaries.mjs";

const withSourceFixture = async (files, run) => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "riddle-web-target-boundaries-"));
  const sourceDirectory = path.join(fixtureRoot, "src");
  await mkdir(sourceDirectory);
  try {
    for (const [relativeFile, source] of Object.entries(files).sort(([left], [right]) =>
      left.localeCompare(right, "en")
    )) {
      const file = path.join(sourceDirectory, relativeFile);
      await mkdir(path.dirname(file), {recursive: true});
      await writeFile(file, source, "utf8");
    }
    return await run(sourceDirectory);
  } finally {
    await rm(fixtureRoot, {force: true, recursive: true});
  }
};

const captureBoundaryError = async (sourceDirectory) => {
  let caught;
  try {
    await auditWebTargetBoundaries({sourceDirectory});
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, "expected the Web Target boundary audit to fail");
  assert.equal(caught.name, "WebTargetBoundaryAuditError");
  assert.ok(Object.isFrozen(caught.violations));
  return caught;
};

test("allows target-local edges, target-to-shared edges, and the real shop adapter seam", async () => {
  await withSourceFixture({
    "core/helper.ts": "export const helper = true;\n",
    "facebook/entry.ts": `
      import "./local";
      import "../core/helper";
      import "firebase/app";
      import "@sentry/browser";
    `,
    "facebook/local.ts": "export {};\n",
    "facebook/secondary.ts": `
      import "../shared";
      import "firebase/auth";
      import "@sentry/browser";
    `,
    "reddit/entry.ts": `
      import "@devvit/client";
      import "../core/helper";
    `,
    "shared.ts": `
      import "./core/helper";
      import {ShopModalPage} from "#shop-modal-page";
      import type {RaceLocale} from "shared-contract/race";
      void ShopModalPage;
      let locale: RaceLocale;
      void locale;
    `,
    "youtube/entry.ts": "import '../core/helper';\n",
  }, async (sourceDirectory) => {
    const report = await auditWebTargetBoundaries({sourceDirectory});
    assert.equal(report.filesScanned, 7);
    assert.equal(report.referencesChecked, 13);
    assert.equal(report.sourceDirectory, sourceDirectory);
    assert.ok(Object.isFrozen(report));
  });
});

test("excludes __tests__, src/test, and *.test.* files from the production graph", async () => {
  await withSourceFixture({
    "__tests__/shared.ts": "import '../youtube/missing';\n",
    "facebook/__tests__/entry.ts": "import '../../reddit/missing';\n",
    "main.test.ts": "import './netflix/missing';\n",
    "main.ts": "import './shared';\n",
    "shared.ts": "export {};\n",
    "test/helper.ts": "import '../facebook/missing';\n",
  }, async (sourceDirectory) => {
    const report = await auditWebTargetBoundaries({sourceDirectory});
    assert.equal(report.filesScanned, 2);
    assert.equal(report.referencesChecked, 1);
  });
});

test("rejects shared-to-target imports across every supported TypeScript module syntax", async () => {
  await withSourceFixture({
    "a-static.ts": "import './netflix/value';\n",
    "b-reexport.ts": "export {value} from './facebook/value';\n",
    "c-export-type.ts": "export type {Value} from './reddit/value';\n",
    "d-dynamic.ts": "void import('./youtube/value');\n",
    "e-require.ts": "require('./facebook/value');\n",
    "f-import-type.ts": "import type {Value} from './reddit/value';\n",
    "g-type-expression.ts": "type Value = import('./youtube/value').Value;\n",
    "h-import-equals.ts": "import Value = require('./netflix/value');\n",
    "facebook/value.ts": "export const value = true;\n",
    "netflix/value.ts": "export = class Value {};\n",
    "reddit/value.ts": "export interface Value {}\n",
    "youtube/value.ts": "export interface Value {}\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(
      error.violations.map(({code}) => code),
      Array(8).fill("SHARED_TO_TARGET"),
    );
    assert.deepEqual(
      error.violations.map(({specifier}) => specifier),
      [
        "./netflix/value",
        "./facebook/value",
        "./reddit/value",
        "./youtube/value",
        "./facebook/value",
        "./reddit/value",
        "./youtube/value",
        "./netflix/value",
      ],
    );
  });
});

test("rejects imports between different target owners", async () => {
  await withSourceFixture({
    "facebook/reexport.ts": "export {value} from '../reddit/value';\n",
    "netflix/dynamic.ts": "void import('../youtube/value');\n",
    "reddit/type.ts": "import type {Value} from '../facebook/value';\n",
    "reddit/value.ts": "export const value = true;\n",
    "facebook/value.ts": "export interface Value {}\n",
    "youtube/value.ts": "export const value = true;\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code}) => code), [
      "CROSS_TARGET_IMPORT",
      "CROSS_TARGET_IMPORT",
      "CROSS_TARGET_IMPORT",
    ]);
    assert.deepEqual(error.violations.map(({owner}) => owner), ["facebook", "netflix", "reddit"]);
  });
});

test("rejects the legacy platform entry while allowing the shop adapter", async () => {
  await withSourceFixture({
    "main.ts": `
      import {PlatformEntry} from "#platform-entry";
      export {ShopModalPage} from "#shop-modal-page";
      void PlatformEntry;
    `,
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code, specifier}) => ({code, specifier})), [{
      code: "LEGACY_PLATFORM_ENTRY",
      specifier: "#platform-entry",
    }]);
  });
});

test("rejects Devvit imports outside Reddit-owned source", async () => {
  await withSourceFixture({
    "facebook/entry.ts": "import '@devvit/client';\n",
    "reddit/entry.ts": "import '@devvit/payments/client';\n",
    "shared.ts": "export * from '@devvit/client';\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code}) => code), [
      "DEVVIT_OUTSIDE_REDDIT",
      "DEVVIT_OUTSIDE_REDDIT",
    ]);
    assert.deepEqual(error.violations.map(({owner}) => owner), ["facebook", "shared"]);
  });
});

test("rejects direct Firebase and Sentry imports from Reddit and YouTube", async () => {
  await withSourceFixture({
    "reddit/firebase.ts": "import 'firebase/functions';\n",
    "reddit/sentry.ts": "export * from '@sentry/browser';\n",
    "youtube/firebase.ts": "void import('@firebase/app');\n",
    "youtube/sentry.ts": "import type {Client} from '@sentry/types';\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code}) => code), Array(4).fill("FORBIDDEN_PROVIDER_IMPORT"));
    assert.deepEqual(error.violations.map(({owner}) => owner), ["reddit", "reddit", "youtube", "youtube"]);
  });
});

test("fails closed when a missing relative path lexically enters target-owned source", async () => {
  await withSourceFixture({
    "main.ts": "import './youtube/does-not-exist.js?raw';\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code, specifier}) => ({code, specifier})), [{
      code: "SHARED_TO_TARGET",
      specifier: "./youtube/does-not-exist.js?raw",
    }]);
  });
});

test("handles extensions and index modules with TypeScript-compatible resolution", async () => {
  await withSourceFixture({
    "facebook/feature.ts": "export {};\n",
    "main.ts": `
      import './facebook/feature.js';
      import './youtube';
    `,
    "youtube/index.tsx": "export {};\n",
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({code}) => code), ["SHARED_TO_TARGET", "SHARED_TO_TARGET"]);
    assert.deepEqual(error.violations.map(({specifier}) => specifier), ["./facebook/feature.js", "./youtube"]);
  });
});

test("rejects non-literal dynamic imports and require calls because ownership is unknowable", async () => {
  await withSourceFixture({
    "main.ts": `
      const moduleName = './youtube/value';
      void import(moduleName);
      require(moduleName);
    `,
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(
      error.violations.map(({code}) => code),
      ["NON_LITERAL_MODULE_REFERENCE", "NON_LITERAL_MODULE_REFERENCE"],
    );
  });
});

test("aggregates violations in deterministic file and source order", async () => {
  await withSourceFixture({
    "z.ts": "import './youtube/missing';\n",
    "a.ts": `
      import '@devvit/client';
      import './facebook/missing';
    `,
  }, async (sourceDirectory) => {
    const error = await captureBoundaryError(sourceDirectory);
    assert.deepEqual(error.violations.map(({file, code}) => `${file}:${code}`), [
      "a.ts:DEVVIT_OUTSIDE_REDDIT",
      "a.ts:SHARED_TO_TARGET",
      "z.ts:SHARED_TO_TARGET",
    ]);
    assert.match(error.message, /failed with 3 violation\(s\)/u);
  });
});
