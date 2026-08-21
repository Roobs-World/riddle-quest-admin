import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {auditDocumentation, root} from "./audit-reddit-documentation.mjs";

test("repository documentation satisfies the Reddit operational contract", async () => {
  assert.deepEqual(await auditDocumentation(root), []);
});

test("audit rejects missing contract text", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "rq-reddit-docs-"));
  for (const relative of ["AGENTS.md", "readme.md", "docs/privacy-data-inventory.md", "docs/credential-rotation-runbook.md", "docs/reddit-games-operations.md", "docs/reddit-incident-response.md", "docs/reddit-moderation-runbook.md"]) {
    await mkdir(path.dirname(path.join(fixture, relative)), {recursive: true});
    await writeFile(path.join(fixture, relative), "incomplete\n");
  }
  assert.ok((await auditDocumentation(fixture)).length > 10);
});
