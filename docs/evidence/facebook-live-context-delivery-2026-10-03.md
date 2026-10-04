# Durable Facebook live context scores — 3 October 2026

New Facebook Live PvP seats retain their original synchronized FBInstant context. Eligible completed scores now recover through the existing server delivery worker after the browser closes. Moving to another context cannot move the retained score. Jest and Reddit retain their own adapters and delivery policies.

## SDK selection and server authority

The Facebook composition wraps its existing live adapter with `createFacebookContextMatchmaking`. Before a new join, explicit invitation acceptance or rematch, it calls the existing context coordinator's `ensureCurrent`, which reads and synchronizes the owning FBInstant SDK context. It uses the selected game language and rejects synchronization failures or locale changes. Solo/unavailable contexts keep ordinary global play available. Concurrent deliveries and retries retain one selection per request; a bounded 32-request cache prevents a later SDK context switch from rewriting the destination. Caller-supplied context selectors are discarded by this adapter.

The shared strict join schema accepts only an optional safe 1–256-character `facebookContextId`. Only an authenticated Facebook UID may use it. The server reads the current locale-bound board and active membership inside the seat-creation transaction. It stores only the domain-separated hashed key, board creation epoch and member join epoch with the private seat. Public live projections expose none of these fields. Raw SDK IDs are request selectors, not stored delivery data. Creation failures publish no seat or match. Receipt/pointer recovery cannot retarget an existing seat. An invitation recipient independently selects its own destination; it does not inherit the creator's board.

Settlement copies the actual winning seat's binding into the existing Facebook live performance outbox. Both winning seats, ordinary private invitations and rematches use the same delivery authority. The worker validates the copied binding against the private winner, ten-solve completion, match and creator's frozen deck. Forfeits keep their established win/referral behavior but cannot manufacture context completion. The shared context writer performs the same private-source and membership checks for browser and worker deliveries. Neither path grants additional currency.

Context delivery uses the existing matchmaking switch independently of official tournaments and referrals. No new SDK, endpoint, Firebase export, scheduler or collection is introduced. Fastest-score writes and existing outbox retries remain idempotent, including a lost delivery acknowledgement. Missing, expired, left, rejoined or replaced boards suppress only the old context projection; they do not suppress eligible official scores. Invalid receipt bindings or corrupted source data quarantine the event. Repair and dry-run/replay use the same score validator even when official tournaments are disabled.

Authenticated context callables retain the existing shared account-operation guard; no redundant lease was added. The worker holds its account lease while writing scores. Actual deletion waits for in-flight work, removes the score and prevents later reconstruction. Legacy unbound live seats retain their existing optional browser submission; no original context is invented for them.

## Local verification

Logs, executable diagnostics, screenshots and source/output hashes are in `artifacts/facebook-live-context-delivery-2026-10-03/`.

- **105 real Firestore/Realtime Database emulator tests in seven suites pass**, including 30 new context-delivery cases, existing Facebook and Reddit tournament delivery, context boards, private invitations, rematches and account deletion. The baseline reproduced missing closed-browser scores for either winning seat. Real signed Reddit join rejects a Facebook selector with the existing safe 403 `permission-denied` envelope, without another provider's writes. Cleanup is restricted to owned demo projects and loopback emulator hosts.
- Full Functions units pass **1,581 tests in 128 suites**, core **315 in 35**, and portal **2,304 in 271**, with 118 browser tests skipped in 15 suites. Reddit trusted-server tests pass **51 cases**. Portal, Functions and Reddit types pass; Functions lint/module-cycle checks, TSDoc and file-size audits pass. Compiled server modules load under **Node 22.23.1** without invoking a handler.
- Injected Facebook and Reddit browser journeys pass through the actual platform adapters. Facebook assertions check the SDK-derived context selector on rematch and explicit acceptance; Reddit requests contain no Facebook selector. **Six selected Jest authenticated browser regressions pass**, with 68 unselected tests. Full Jest browser acceptance remains unestablished.
- All **six isolated builds and explicit output-directory audits pass**: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Existing provider SDK, ads, Reddit same-origin and self-contained artifact boundaries remain enforced. Facebook history/rematch/context recovery screenshots were visually inspected; no new visible copy was introduced.

Early diagnostic logs remain separate from final passing logs. They include the missing-score baseline, fixture outbox cleanup, public deleted-account response expectations and the corrected Reddit rejection-status assertion. These corrections did not weaken production authority or change the gateway error contract.

## Provider and release limits

Authenticated Meta Social Technologies MCP reads are available. The 3 October read-only review check returns **`UNSUBMITTED`**, with null submission/completion timestamps and no last reviewed submission. Its `is_approved: true` boolean alone does not establish completed App Review. No provider settings were changed.

The user reports Firefox MCP active, but this session still exposes no callable Firefox tools. Browser evidence above comes from the repository's injected Chromium harnesses, not Firefox or real Meta role accounts.

This shared dirty checkout changed concurrently. The manifest explicitly records unconfirmed atomic source/build provenance, upload ineligible, no deployment by this chat and no provider mutation by this chat. Local checks do not establish deployed-source equivalence or hosted acceptance. Native context choice still does not bind a selected friend to the global live queue. Signed hosted identities, purchase/refund contracts and payout readiness, rewarded-ad verification, notification consent/delivery, physical context cleanup and representative role/device acceptance remain separate review gates.
