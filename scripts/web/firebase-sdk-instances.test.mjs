import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import test from "node:test";

for (const [scope, manifest] of [
  ["web", "../../package.json"],
  ["Android", "../../platforms/native/android/package.json"],
  ["Functions", "../../firebase-functions/package.json"],
]) {
  test(`${scope} Realtime Database registers on its Firebase app instance`, async () => {
    const requireFromScope = createRequire(new URL(manifest, import.meta.url));
    const {initializeApp, deleteApp} = requireFromScope("firebase/app");
    const {getDatabase} = requireFromScope("firebase/database");
    const app = initializeApp({
      projectId: "demo-firebase-instance-regression",
      appId: "1:123456789:web:fixture",
      apiKey: "local-fixture-key",
      databaseURL: "https://demo-firebase-instance-regression-default-rtdb.firebaseio.com",
    }, `sdk-instance-${scope}-${randomUUID()}`);
    try {
      assert.equal(getDatabase(app).app, app);
    } finally {
      await deleteApp(app);
    }
  });
}

test("compiled browser Firebase registers Realtime Database on its app instance", async () => {
  const {build} = await import("vite");
  const output = await mkdtemp(join(tmpdir(), "riddle-quest-firebase-sdk-"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const fixture = join(root, "src", "web", "__tests__", "firebase-sdk-runtime-fixture.ts");
  try {
    await build({
      root,
      configFile: false,
      envDir: output,
      logLevel: "silent",
      plugins: [{
        name: "firebase-sdk-instance-fixture",
        resolveId(id) { if (id === "firebase-sdk-instance-fixture") return fixture; },
        load(id) {
          if (id !== fixture) return;
          return `
            import {initializeApp, deleteApp} from "firebase/app";
            import {getDatabase} from "firebase/database";
            export async function constructDatabase() {
              const app = initializeApp({
                projectId: "demo-firebase-instance-regression",
                appId: "1:123456789:web:fixture",
                apiKey: "local-fixture-key",
                databaseURL: "https://demo-firebase-instance-regression-default-rtdb.firebaseio.com",
              }, "compiled-sdk-regression");
              try { return getDatabase(app).app === app; }
              finally { await deleteApp(app); }
            }
          `;
        },
      }],
      build: {
        outDir: output,
        emptyOutDir: true,
        rolldownOptions: {
          input: "firebase-sdk-instance-fixture",
          preserveEntrySignatures: "strict",
          output: {entryFileNames: "fixture.mjs"},
        },
      },
    });
    const compiled = await import(pathToFileURL(join(output, "fixture.mjs")).href);
    assert.equal(await compiled.constructDatabase(), true);
  } finally {
    await rm(output, {recursive: true, force: true});
  }
});
