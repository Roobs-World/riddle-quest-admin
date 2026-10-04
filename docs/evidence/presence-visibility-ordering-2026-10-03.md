# Presence permission delivery ordering — 3 October 2026

This local change closes a reproduced privacy race in the existing presence mirror. A refresh read an allowed Firestore rivalry, paused before its RTDB write, and then overwrote the revocation from a successfully completed `blockKnownRival` call. An authenticated rules client could again read the blocked player's presence. The original implementation failed both Facebook and Jest cases in `red.log` and `red-confirmed.log`; the latter also confirmed that the block document existed and that the ACL was denied before the older write completed. No browser cache was involved.

`refreshPresenceVisibility` now reads the relationship and both block documents in one current Firestore transaction. Their database observation timestamp supplies a full nanosecond revision. An RTDB transaction updates only the directed permission edge and refuses an older decision; equal-revision denials win. Denied edges retain their revision. The reverse viewer entry remains a cleanup index through denial and has no read-authorizing role. Both account owners use the existing operation lease so deletion waits for prior mirrors and later cleanup events cannot recreate an edge. The lease helper accepts the same Firestore instance as the caller; existing three-argument callers preserve their default behavior.

The rules accept both existing boolean grants and the new `{allowed, revision}` record. Client status payloads, own-session write validation, opt-in requirements, Facebook rollout checks and platform adapters are unchanged. Reddit continues polling its existing server-owned same-origin gateway and independently checking bilateral Firestore blocks. There is no new provider SDK, endpoint, collection or visible copy.

The regression uses real Admin SDK Firestore and RTDB operations, the production block service, the production deletion guard and authenticated rules clients. A narrow proxy delays only one storage delivery after its source was read; explicit promise barriers determine ordering without sleeps. The private fixtures require a `demo-*` project and both loopback emulator hosts before cleanup. The four existing related fixtures now require the same guard.

Validation:

- **29 emulator tests in six suites passed**, including nine new cases: either Facebook/Jest owner blocks; a delayed denial after unblocking; relationship removal with late delivery and deletion-index cleanup; and deletion of either Facebook owner with a pending mirror and subsequent cleanup-trigger replay. Existing multi-device observer cancellation, opt-out, rules, social safety, signed Reddit live safety and Reddit presence cases passed.
- **1,581 Functions unit tests in 128 suites passed.** The first broad invocation omitted Jest's required VM-module flag and failed the Yahoo dynamic-import cases; the final run uses `NODE_OPTIONS=--experimental-vm-modules`. An initial integration adapter also failed to return the rules-disabled callback result; the fixture now forwards the actual transaction snapshot. Both intermediate failures are retained.
- Functions types, module-cycle checks, targeted lint, TSDoc, file-size and whitespace audits passed. The compiled modules loaded under **Node 22.23.1**, without invoking a handler.
- **All six isolated target builds and private output-directory dependency audits passed:** Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Outputs are under `/home/craig-beswetherick/.cache/riddle-quest-review/presence-visibility-ordering-20261003/`. This change has no UI delta; authenticated emulator listeners verify the affected read behavior.

The emulator command is:

```bash
pnpm --dir firebase-functions exec firebase emulators:exec \
  --config /home/craig-beswetherick/Documents/riddle-quest/artifacts/presence-visibility-ordering-2026-10-03/diagnostic/firebase.json \
  --project demo-presence-ordering --only firestore,database \
  'NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config /home/craig-beswetherick/Documents/riddle-quest/artifacts/presence-visibility-ordering-2026-10-03/diagnostic/jest.cjs --runInBand'
```

`artifacts/presence-visibility-ordering-2026-10-03/` contains the diagnostic runner, original failures, final results, compile log, build directories and hashes. Firebase documents the transaction retry behavior in its [Admin RTDB guide](https://firebase.google.com/docs/database/admin/save-data) and current server transaction snapshots in the [Firestore SDK reference](https://googleapis.dev/nodejs/firestore/latest/Firestore_.html).

A bounded operator tool now prepares the legacy reconciliation step; see the [follow-up evidence](presence-visibility-reconciliation-2026-10-03.md) and [staging runbook](../presence-visibility-reconciliation.md). It has not been run against hosted state.

This is not a hosted acceptance or deployment claim. Deploy the rule and mirror changes together, drain older non-versioned writers, and recompute existing legacy permissions from current relationships and blocks before accepting the hosted ordering guarantee. Legacy booleans remain compatible during preparation and do not gain revisions until recomputed. Verify those steps in staging, including active observers and deletion retries. No provider or production data was modified by this work.

Meta MCP's fresh read still reports **UNSUBMITTED**, with no submission time, completion time or completed-review identity; `is_approved: true` alone does not establish review completion. Firefox DevTools MCP is enabled in local configuration, but its callable tools and browser connection are absent from this session's inventories. No Firefox acceptance was performed. The shared checkout is concurrently edited, so the manifest expressly denies frozen source/build provenance and upload eligibility.
