# Multiplayer entry recovery after another tab abandons a run

A cold resume of an already-abandoned run returned to the Play hub without loading categories. Recovery through resumed preparation/readiness had the same dead end. With no cached catalog, the category grid remained empty and the session was idle with no error or loading indicator. Starting a selected challenge into an already-abandoned authority response could also retain the prior challenge selection.

The session now uses one abandoned-run transition for start, resume, readiness and concurrent guess/hint/skip delivery. It clears run ownership, old challenge selection and retry intents, keeps an explicit close request, and loads a missing catalog exactly once. Cached categories remain available without another read. Accepted terminal starts no longer become failed-start retries merely because their resulting hub has no active run. A failed catalog delivery retries the catalog and cannot replay the abandoned run or its old challenge. Existing lifetime guards stop follow-up work when an observer replaces the account.

## Evidence

- `artifacts/race-abandoned-entry/unit-before.log`: start, resume and readiness cases reproduced missing catalog delivery; two retained cached-catalog/close cases passed.
- `browser-before.log`: the exact prior verified production session failed the assertion that abandoned entry loads a missing catalog. The prior source is retained in `prior-race-session.ts`; its SHA-256 matches the preceding scheduled-draft focused verification record.
- `unit-after.log`: eleven public-session cases pass. Covers all three entry paths, two selected-challenge paths, catalog failure/retry and duplicate receipts across each entry path, account replacement, cached categories and explicit close intent.
- `browser-after.log`: four desktop/mobile cold resume and resumed readiness paths load all six category buttons, clear the old run pointer and perform no automatic mutation. A deliberate category selection issues one fresh creator start without old challenge/rivalry metadata and reaches a playable puzzle without a visible error.
- `full-client.log`: all 178 runnable client suites pass with 1,578 passing tests. The existing 13 suites and 95 tests remain skipped.
- Portal types, TSDoc, maintainable file sizes, security, scalability, all seven isolated builds and their exact artifact/dependency verification pass. No new visible text or translation is introduced.

`docs/common/development/development-tasks/race-abandoned-entry.json` includes all prior 34 gates plus this new browser gate. The stable full-source completion receipt and automatic dashboard recording remain pending while the authorized hosted pathway chat continues its E2E work and edits evidence. Focused verification does not replace or relax the stable-source gate.

The pinned active Jest draft is unchanged and remains unpublished. This client change requires no Firebase Functions deployment. The multiplayer reliability audit remains active.
