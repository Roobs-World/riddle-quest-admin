# Multiplayer provider entry ownership

Verified 2026-10-01 against local production source. The hosted Jest E2E chat remains active; its preview and source evidence are untouched.

## Failure and change

Optional provider entry calls dispose and publishes an empty cache before installing its adapters. A synchronous subscriber could install a replacement account or request teardown during that notification; the older entry then overwrote the newer choice. Two public-interface regression cases failed against the prior module, while 36 retained cases passed.

The provider module now advances a private lifetime generation on disposal. Entry captures the expected cleanup generation and installs its adapters only if that generation remains current after notifications. Reentrant replacement owns subsequent reads and recordings; reentrant disposal leaves adapters inactive. Existing read receipts, recording guards and per-context ownership continue handling asynchronous completion. No provider SDK, visible text or locale data was added.

## Verification

- Complete client suite: 1,599 tests in 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Provider module suite: 38 cases passed. New public-interface cases exercise replacement with Arabic adapters and explicit disposal during cleanup notification, checking read/write recipients, returned locale and timer cleanup.
- Twenty-two retained production browser scenarios passed: recording recovery (4), recording deadlines (8), capability removal/re-entry (8) and server-confirmed outcome catch-up (2).
- All seven configured isolated builds and exact target dependency-evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed. The declaration documentation check initially caught a missing comment on the new local generation and passed after it was added.

The new reentrant notification failure is reproduced by public module tests; the browser checks are regression coverage for the production integration. The saved prior provider source hash matches the earlier recorded provider source. Logs and focused source/artifact proof are in `artifacts/race-provider-entry-ownership/`. This client-only change requires no Firebase Functions deployment.

## Completion receipt

The focused proof is `artifacts/race-provider-entry-ownership/verification-held.json`, not an accepted full-source dashboard receipt. The 38-check manifest `docs/development-tasks/race-provider-entry-ownership.json` retains all previous backend, draft and injected browser gates. The source-stability guard remains unchanged. Run guarded completion after the other E2E chat finishes changing source evidence. No Jest upload, activation or publication was performed.

The latest hosted E2E observations report challenge/onboarding and result/achievement dialog overlaps. Those presentation/focus concerns remain to be investigated against current local source; this provider entry change does not resolve them.
