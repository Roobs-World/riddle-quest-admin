# Native friend challenge deployment — 2 October 2026

The friend challenge release is deployed to Jest and staged for Facebook testing. Both final artifacts use source `fa4c97fa1965c57381e2b3dc8f2382f341e8ad1a`, which combines the native invitation adapter with the latest committed player-level, notification, and startup changes. The managed release checkout is `/home/craig-beswetherick/.codex/worktrees/friend-challenge-release/riddle-quest`; unrelated uncommitted changes in the main checkout were preserved.

## Deployment

| Target | Authoritative result | Artifact |
| --- | --- | --- |
| Jest | Ready and active: `01a0fe06-bf09-71e0-8d47-01cb976b9d25`; activated at `2026-10-02T19:10:57.512Z` | `1.0.0-dev.20261002191025.fa4c97fa1965.6fc8b870`; ZIP SHA-256 `c65a0d406c53b40ab1e1b67bed8ddfe2f74a461574df386c1d04c2489b344741` |
| Facebook | Version 6, bundle `26805848032447156`, status **Testing** | ZIP SHA-256 `b0492d8eb45811c48e75747724ebd5b3cd219f4d6d2c9ace704781fdb5d081b0` |

The games remain unpublished. No public production promotion or moderation submission was performed. The user accepted Meta's Direct Install Terms before upload. Facebook upload acceptance was recorded with `facebook:draft accept` against the exact archive hash and bundle ID.

## Hosted checks and deployment repairs

- Both final hosted builds start, authenticate, load multiplayer categories, and create a private friend lobby with the existing backend. The waiting screen explicitly says the invitation expires after 15 minutes.
- Facebook opens Meta's native **Challenge a friend** picker populated from the player's Facebook friends. Closing it returns to the same lobby with the challenge action available. No friend was selected and no real invitation was sent.
- Jest's sandbox account creates the private lobby, invokes the SDK sharing action, and returns with no game error. This does not prove SMS delivery or a recipient device notification.
- The initial isolated Jest upload exposed a strict client/server mismatch because the deployed backend already supplied player `level`. The final merged build accepts that contract; the earlier build is inactive.
- Facebook initially received HTTP 401 from `exchangeFacebookIdentity`. Server logs reported `facebook-provider-identity-conflict`. A read-only comparison found one existing Facebook identity: it matched UID secret version 1 and did not match the newly added version 2. The original key was restored as version 3; only the secret binding configuration was updated for `exchangeFacebookIdentity`, `issueFacebookIdentityNonce`, `facebookDataDeletionCallback`, `deleteAccount`, and `deliverLiveRaceChallengePush`. All five configuration operations completed and the functions are active on version 3. Source, other secrets, accounts, identity records, and balances were preserved. Secret values were never printed or saved to evidence.

## End-to-end verification

The final merged-source invitation harness passes at **390×844** and **1280×900** for Jest, Facebook `inviteAsync`, and Facebook `shareAsync` fallback. It uses two browser contexts and the compiled server authority against a dedicated Firestore emulator. Checks cover opaque SDK payloads, native dismissal/failure retry, incoming notification, no automatic acceptance, acceptance into the original lobby, shared countdown/gameplay, addressed inbox alerts while open and after reload, consent fallback/revocation, and hiding the action on unsupported platforms.

The real emitted Jest service worker also passes the closed-game browser check: one browser notification with no game page open, duplicate replacement, and rejection of expired/malformed messages. The provider push event is injected; actual FCM device delivery is not claimed.

The 18 focused adapter unit tests and all project type checks pass. All seven target builds pass: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks. Security and high-severity dependency audits pass, including the `basic-ftp` 6.2.1 override; pre-existing documented image-size exceptions remain. Artifact isolation, secret scanning, and W3C validation pass for the uploaded builds.

## Broader checks and notification limits

The full Jest release gate was attempted and failed on pre-existing core 100% coverage requirements even though its 283 tests passed. A separate broad platform browser run had 44 passes and 30 failures, mainly recorded-race expectations in the Jest authentication suite that no longer match the live-only multiplayer entry. The Facebook suite passed. After merging the latest committed work, the global TSDoc audit reports 93 undocumented declarations. These broader checks are not reported as green.

The final Jest upload used the existing `JEST_RELEASE_SKIP_TESTS=true` option after the focused verification above. This skips the broad production/packaged-browser suites; it retains immutable source/dependency checks, Console metadata approval, uploaded artifact validation, secret audits, and W3C validation. No coverage thresholds or test expectations were weakened.

Current deployed notification configuration has `JEST_CHALLENGE_PUSH_ENABLED=1`; `FACEBOOK_CHALLENGE_PUSH_ENABLED` is unset. Separate Facebook server push therefore remains disabled. Native platform invitations and the durable multiplayer inbox remain available. Real SMS delivery, real Facebook invitation delivery to a second person, and actual offline device delivery were not tested.

Evidence and logs: `artifacts/friend-challenge-deploy-2026-10-02/`. The final Jest version response and the two final hosted lobby screenshots are included. Jest processing barriers are retained with the authoritative ready/active evidence; no upload of the same source should be retried without reconciling those local receipts.
