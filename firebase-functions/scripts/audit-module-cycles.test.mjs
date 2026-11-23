import assert from "node:assert/strict";
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {
  auditProductionModuleCycles,
  ModuleCycleAuditError,
} from "./build/audit-module-cycles.mjs";

const withSources = async (sources, operation) => {
  const directory = await mkdtemp(path.join(tmpdir(), "riddle-quest-module-cycle-"));
  try {
    await Promise.all(Object.entries(sources).map(async ([name, source]) => {
      const target = path.join(directory, name);
      await mkdir(path.dirname(target), {recursive: true});
      await writeFile(target, source);
    }));
    await operation(directory);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
};

test("accepts an acyclic runtime graph and ignores erased type-only edges", async () => {
  await withSources({
    "entry.ts": "import {value} from './value'; export const result = value;\n",
    "value.ts": "import type {EntryShape} from './entry'; export const value: EntryShape = 1;\n",
  }, async (sourceDirectory) => {
    const result = await auditProductionModuleCycles({sourceDirectory});
    assert.equal(result.modulesScanned, 2);
    assert.equal(result.referencesChecked, 1);
  });
});

test("rejects a barrel-induced runtime cycle with deterministic module evidence", async () => {
  await withSources({
    "facebook/account.ts": "import {remove} from '../profile/accountDeletion'; export const run = remove;\n",
    "profile/accountDeletion/index.ts": "export {callable} from './callable'; export {remove} from './data';\n",
    "profile/accountDeletion/callable.ts": "import {run} from '../../facebook/account'; export const callable = run;\n",
    "profile/accountDeletion/data.ts": "export const remove = () => undefined;\n",
  }, async (sourceDirectory) => {
    await assert.rejects(
      auditProductionModuleCycles({sourceDirectory}),
      (error) => {
        assert.ok(error instanceof ModuleCycleAuditError);
        assert.deepEqual(error.cycles, [[
          "facebook/account.ts",
          "profile/accountDeletion/callable.ts",
          "profile/accountDeletion/index.ts",
        ]]);
        return true;
      },
    );
  });
});

test("excludes test modules from the production graph", async () => {
  await withSources({
    "entry.ts": "export const value = 1;\n",
    "entry.test.ts": "import {fixture} from './fixture'; export const testValue = fixture;\n",
    "fixture.ts": "import {testValue} from './entry.test'; export const fixture = testValue;\n",
  }, async (sourceDirectory) => {
    const result = await auditProductionModuleCycles({sourceDirectory});
    assert.equal(result.modulesScanned, 2);
  });
});
