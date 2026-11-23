import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {collectFirebaseFixtureExports} from "./firebase-fixture-exports.mjs";

test("named Firebase imports retain exported names and omit type-only bindings", () => {
  assert.deepEqual(collectFirebaseFixtureExports({adapterSource: `
    import type {Profile} from '../.././firebase';
    import {auth as account, type Profile, completeGame as finish} from '../.././firebase';
    import {loadUserDocument, auth} from '../.././firebase';`, firebaseModulePath: "/unused.ts"}),
  ["auth", "completeGame", "loadUserDocument"]);
});

test("namespace fixtures include runtime declarations and re-exports without executing their module", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-firebase-fixture-exports-"));
  try {
    await writeFile(path.join(directory, "callables.ts"), `export const getCurrentDailyChallenge=()=>{};
      export class RuntimeClass {} export interface Profile {} export const spendCoins=()=>{};`);
    const firebaseModulePath = path.join(directory, "firebase.ts");
    await writeFile(firebaseModulePath, `throw new Error('Firebase must never initialize during fixture discovery');
      export const auth={}; export async function loadUserDocument(){}
      export {getCurrentDailyChallenge as daily} from './callables';
      export * from './callables';
      export type {RuntimeClass as TypeOnlyClass} from './callables';
      export type LocalType={coins:number};`);
    const names = collectFirebaseFixtureExports({adapterSource: `import * as backend from '../.././firebase';`, firebaseModulePath});
    assert.deepEqual(new Set(names), new Set(["auth", "loadUserDocument", "daily", "getCurrentDailyChallenge", "RuntimeClass", "spendCoins"]));
  } finally {await rm(directory, {recursive: true, force: true});}
});

test("the current namespace-forwarding adapter exposes its shared host callable surface", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const names = collectFirebaseFixtureExports({adapterSource: await readFile(path.join(root, "src/platform/firebase/browserHostServices.ts"), "utf8"),
    firebaseModulePath: path.join(root, "src/platform/firebase/browserClient.ts")});
  for (const name of ["auth", "loadUserDocument", "getCurrentDailyChallenge", "getCurrentClassicRiddle", "getClassicRiddleBuffer", "completeGame", "spendCoins"])
    assert.ok(names.includes(name), `Missing real host dependency ${name}`);
  assert.ok(!names.includes("CurrentRiddleResponse"));
});

test("unsupported or empty fixture imports fail before a browser can receive an empty stub", () => {
  for (const adapterSource of [`import type * as backend from '../.././firebase';`, `import {type Profile} from '../.././firebase';`, `import backend from '../.././firebase';`])
    assert.throws(() => collectFirebaseFixtureExports({adapterSource, firebaseModulePath: "/unused.ts"}));
});
