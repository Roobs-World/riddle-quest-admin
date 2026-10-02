# Facebook testing preparation — 1 October 2026

The current working tree has been prepared and checked for local testing. No Meta upload,
backend deployment, review submission, or public promotion was performed. Existing
Meta upload receipts were preserved. Unrelated multiplayer changes already in the
working tree were retained.

## Candidate

- Local ZIP: [riddle-quest-facebook-local-test.zip](../../artifacts/facebook-testing-readiness-2026-10-01/riddle-quest-facebook-local-test.zip).
- SHA-256: `22886cd442943910eddeb252a0594cef536b8b4abb56d41b0605b771b944007a`.
- Size: 2,757,149 bytes; 402 ZIP entries; root `index.html` and `fbapp-config.json` verified.
- Build: 400 files, 4.16 MB uncompressed, 0.43 MB initial resources.
- [Manifest](../../artifacts/facebook-testing-readiness-2026-10-01/manifest.json) records the source HEAD, dirty state, tracked-diff hash, and inspected SDK hash.
- This ZIP includes working-tree changes and is a **local testing candidate**, not a canonical upload handoff. The upload guard still requires a clean reviewed source commit. Prepare the exact-byte handoff using the [Facebook operations runbook](../facebook-instant-games-operations.md) after review and prerequisite reconciliation.

The most recent committed hosted evidence is [Testing version 4](facebook-testing-upload-2026-09-27.md),
bundle `28232737223063645`, uploaded on 27 September. This local candidate has not
replaced that version. The role-account link is
[Riddle Quest on Facebook](https://www.facebook.com/gaming/play/1748953042991569/).

## Changes

The browser contract was checked against Meta's actual distributed
[Instant Games v8 SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js), downloaded
on 1 October. Inspected bytes had SHA-256
`b00592e89ece9357675cb130d802f3908172dc2f27e1b54a702e18eff0f2ac23`.
The SDK is still loaded from Meta in the Facebook artifact; it was not vendored.

- Await `startGameAsync()` before player identity/cloud reads. Report SDK loading complete before requesting start. Regression fixtures reject premature player reads and verify that failed start never reads identity or cloud data.
- Use `FBInstant.getLocale()` when there is no supported saved language. Normalize Meta region forms such as `pt_BR` and `ja-JP`; saved player choice wins.
- Correct native matchmaking from the nonexistent `context.matchPlayerAsync` contract to top-level `FBInstant.matchPlayerAsync`. Use underscore-separated race locale tags and reject tags Meta would reject.
- Destroy profile overlays with `destroyAsync()`, the v8 provider method. Attempt destruction even when dismissal fails. Provider names/photos continue to stay inside Meta overlays.
- Subscribe to Meta's `onResume` when available. Connect provider pause/resume to shared gameplay/audio, including pauses while browser visibility stays `visible`. Storage flush and presence lifecycle remain active.
- Remove both native social and backend matchmaking capabilities when authenticated Facebook configuration disables matchmaking. Configuration failure also hides profile overlays.
- Skip purchase-related gameplay/profile tour steps when provider checkout is unavailable. Existing translations remain used by platforms that expose checkout; no locale keys were removed or added. Jest retains its coin-shop tour.

Facebook uses its own nonce-bound signed player exchange, custom Firebase auth/App
Check, Meta cloud data, contexts, overlays, and Facebook-only ad adapter. Shared
gameplay, coin authority, and recorded-opponent race matchmaking continue through
the authenticated game backend. They do not import Jest's SDK or identity/purchase
adapters. The race hub's normal opponent-search action uses that authoritative backend;
the native matching fallback and friend-context adapter are separate SDK paths.

At this earlier capture, purchases, rewarded grants, and notification permission
prompts remained staged. The native permission adapter was subsequently implemented
in the [SDK follow-up](facebook-sdk-followup-2026-10-01.md), and the
[configuration follow-up](facebook-config-readiness-2026-10-01.md) removes its local
predeployment off switch. Purchases and rewarded grants still require verified Meta
contracts described in the operations runbook. Interstitials require a valid Facebook placement,
supported SDK API, eligible configuration, and hosted acceptance.

## Local verification

Validation logs are retained in
[the evidence directory](../../artifacts/facebook-testing-readiness-2026-10-01/validation/).

| Check | Result |
| --- | --- |
| Full Portal unit suite | 162 suites, 1,331 tests passed; 94 opt-in browser tests skipped in this unit run |
| Backend preflight | 114 suites, 1,372 tests passed; configuration/export/secret audits, types, lint, and build passed; repeated under supported Node 22 |
| All target builds | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks built; target artifact audits passed |
| Facebook injected SDK browser | Passed startup/failure UI, signed auth/App Check, French preference restore, purchase-free tour, portrait/desktop race layout, context changes, overlay cleanup, immediate solo feedback, SDK pause/resume while visible, save flush/reload, username change, and deletion |
| Jest gameplay browsers | 5 suites / 16 tests passed, including existing purchase guidance, profile, queued coin actions, music, and coin collection |
| Jest authentication browser | 61 tests passed, including identity, registration, commerce/subscription, notifications, referrals, race recovery, and deletion |
| Other browser harnesses | Reddit 1, YouTube 10, Netflix/Yahoo 2 tests passed |
| Release-script tests | 128 passed |
| Boundaries and source checks | Facebook secret/profile/commerce/copy, locale, types, TSDoc, maintainable-file size, and whitespace checks passed |

The injected fixtures now use the v8 method placement and overlay disposal API.
These tests demonstrate local behavior; they do not demonstrate Meta-hosted receipt,
permission, advertising, CSP, or physical-device acceptance. A
[portrait context recovery capture](../../artifacts/facebook-testing-readiness-2026-10-01/context-dialog-recovery-390.png)
is retained from the injected fixture.

## Hosted testing before deployment

Use disposable app-role accounts on Facebook web and supported iOS/Android clients.
Record the Testing version, bundle ID, exact uploaded ZIP hash, device, and result
for each check. Do not place real player assertions, auth tokens, raw provider IDs,
or purchase receipts in repository evidence.

1. Confirm the deployed backend revision matches the reviewed candidate's dependencies and feature switches. Prepare the canonical upload handoff from a clean reviewed commit and activate only the non-production Testing version.
2. Cold-launch and reload. Verify signed identity succeeds, core content loads, unsupported features stay hidden, and the network contains Meta/Firebase endpoints with no Jest SDK/identity/checkout traffic. Retry a temporarily unavailable backend and verify recovery.
3. Complete onboarding and the three-step gameplay tour with checkout disabled. Confirm no coin purchase guidance/buttons appear. Check all supported language selection, Meta locale fallback, portrait layout, landscape layout, keyboard, and scrolling.
4. Play Classic and Daily rounds, submit wrong/correct answers, spend hints/skips, and compare authoritative balances/progress after reload. Change language/audio/accessibility preferences and confirm provider storage restores them.
5. Trigger Meta host pause/resume, background/foreground, and app switching. Verify input/animation/audio pause, cloud flush finishes, the visible game resumes, and opted-in presence stops/restarts. Test denied/failed save and interrupted sessions.
6. With social features enabled, change the native context, use two authenticated role accounts in the same context, verify board synchronization and provider overlay appearance/cleanup, search for a recorded opponent, and exercise block/report/presence gates. Repeat with matchmaking disabled and a failed configuration read.
7. Change the game-owned username and delete a disposable account. Verify game/backend state, Meta cloud projection, and browser preferences are cleared and stale callbacks cannot recreate them.
8. Confirm commerce and rewarded grants remain hidden. For the current native prompt adapter, test an eligible authoritative win, dismissal, weekly retry, accepted subscription, unsupported APIs, and unknown age; the independent gates must suppress ineligible prompts. Test interstitial lifecycle only after its placement/configuration is valid. Purchase/refund/recovery acceptance still requires verified contracts. Notification delivery/templates remain separate from subscription consent.

The dedicated [Facebook privacy notice](https://roobsworld.com/riddle-quest/privacy)
and [terms](https://roobsworld.com/riddle-quest/terms) both returned HTTP 200 on
1 October. Their Meta-setting publication is recorded in
[the privacy publication evidence](website/facebook-privacy-publication-2026-09-27.md).
According to the latest saved [approval walkthrough](../facebook-approval-walkthrough.md),
IARC, Approved Partner submission, payout setup, business-details reconciliation,
and operational support/retention checks remain open. Their current dashboard state
was not rechecked in this local preparation. Public release still needs those gates,
hosted acceptance, and final owner approval.
