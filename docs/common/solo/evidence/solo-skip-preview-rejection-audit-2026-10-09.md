# Skip preview and rejection ownership audit

Seven type-checked diagnostics exercise the actual recovery hook, reducer and durable journal on the current worktree. Four fail; three controls pass.

The speculative preview admission path checks only request identity and the presence of an outstanding paid action. It admits a wrong Classic index, a Challenge-mode target, and the old next question after the current round has advanced to index 3. The definitive rejection path restores the journal root unconditionally, so rejecting a Skip of index 1 replaces a newer index-3 round with index 1.

Controls pass for a valid preview, rejection while the original question remains current, and the existing rejection rollback from index 2. The index-2 rollback control deliberately represents existing behavior; it does not prove that an independently confirmed index-2 round belongs to the speculative preview. A fix must encode that ownership rather than treating every next-index round as provisional.

Executable diagnostics, initial Jest results and the reviewed source hash are in artifacts/solo-skip-preview-rejection-audit-2026-10-09/. No production source changed. Next work is to bind preview admission and rollback to the actual issued predecessor and admitted speculative session, retain ordinary rejected-payment settlement, and verify newer-round preservation through rendered delivery races and all six builds. The broader goal remains active.
