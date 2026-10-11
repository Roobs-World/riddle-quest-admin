# Paid receipt settlement after a transient storage failure

The previous goal turn completed the optional Skip isolation change. This audit found a separate persistence recovery gap using the actual recovery hook, reducer and Map-backed concrete journal storage adapter. No production source was changed in this audit.

The diagnostic mounts a durable paid Skip journal with its explicitly owned speculative index-2 successor and an unrelated index-3 draft. A definite rejection removes only the owned preview in memory and restores index 1. Storage throws during the settled journal write, then becomes writable before the clock advances. The old durable journal still includes both indices 2 and 3, the paid request and its preview marker. The assertion requiring only the unrelated index-3 draft fails. The otherwise identical successful-write control passes. This does not claim a cloud charge or immediate visible preview resurrection on reload; it proves obsolete rejected content remains available to cold recovery.

Command (run from repository root):

```sh
pnpm_config_verify_deps_before_run=false pnpm --dir packages/portal exec jest --config jest.config.cjs --runInBand --roots /home/craig-beswetherick/Documents/riddle-quest/artifacts/solo-paid-settlement-storage-audit-2026-10-09 --testMatch '**/*.test.ts'
```

Final log: `artifacts/solo-paid-settlement-storage-audit-2026-10-09/recovery-diagnostic-final.log`. Two suites: one failed diagnostic, one passing control; elapsed 0.22 seconds. The final clock respects cancelled interval handles. Earlier probes remain labelled diagnostic logs. Source hashes are in `source-inputs.json`.

Root cause: the paid-result handler ignores `adapters.journal.write(remaining)` failure, drops the paid request in memory and cancels its renewal interval. Draft persistence can incidentally repair the journal after another input change, but an idle mounted game has no retry when storage recovers. A journal write cannot succeed while storage continues to throw; the repair must target recovery after storage becomes writable.

Next implementation should retain a scope-owned pending-persistence obligation after a failed settlement write. Its bounded retry must serialize the latest in-memory journal, preserve unrelated future drafts and requests, retire on account/provider lifetime changes, and stop after successful persistence. It must not replay the settled payment, overwrite a newer journal snapshot, or add continuous writes after settlement. Tests must cover rejection and acceptance, storage recovery, newer drafts, account/provider retirement, and cancelled timer callbacks. The immediate-close case during a continuing browser-storage outage remains outside any guarantee of successful durable writing.

No deployment, commit, push or production modification was made. The broader goal remains active; this is a reproduced finding, not a completed fix.
