# Jest Fund readiness

Updated 26 November 2026 after authenticated Jest Simulator and hosted sandbox checks. **Automated Fund eligibility is verified; funding has not been awarded.** The current release passed all 17 Basic Launch and all 6 Fund checks and displayed “Eligible to apply.” The observed Recommended checkpoint is 3/4. Referral imagery and race findings are fixed in source with targeted checks passing; retesting a newly uploaded build is pending. Manual review, remaining live-platform checks and physical-device acceptance are still pending.

## Hosted checks on 26 November

The [hosted observations](evidence/fund-hosted-2026-11-26/observations.json) record the exact tested build and limits. A Firefox sandbox session completed onboarding, three Classic wins with correct rewards, working Next Level transitions, active-Premium offer suppression, checkout cancellation without a balance change, and a race through results. Reload retained the 4,560-coin balance and next Classic riddle. Jest's screenshot provider captured gameplay, shop and Profile guidance. Desktop play remained usable for more than ten minutes; this is not a physical-phone soak or a measured mobile loading result.

The final Profile tutorial step exposed an undersized scrolling card in the 424×452 game frame. The released fix removes its side-space height cap while preserving normal above/below positioning. The exact released build was retested in Firefox at the same 424×452 game frame: Profile steps 1–9 replayed, inspected cards and the final Got it action were fully visible, Enter completed the last step, and the 4,560-coin balance persisted. See the [release and retest evidence](evidence/jest-fund-guidance-2026-11-26.json). Local checks passed 291 tests across 13 suites, including notification consent/retries and subscription coin refresh. Two stale test fixtures were corrected; the stronger Profile browser assertions were added but the local browser harness was not executed.

On the current release, all six authorized zero-charge coin pack checkouts completed and awarded the displayed amounts: 7,000, 3,400, 1,600, 900, 550 and 250 coins. The balance rose from 4,560 to 18,260; reload preserved 18,260 and the same SNAIL riddle. Jest returned six complete sandbox transactions, each with zero credits and revenue. See [purchase evidence](evidence/fund-hosted-2026-11-26/sandbox-purchases.json). Live interrupted-purchase recovery remains unverified; Simulator seeded recovery completed 1/1.

The existing Premium offer remains hidden while active. [Exact-account verification](evidence/fund-hosted-2026-11-26/sandbox-existing-subscription.json) established that this sandbox subscription was already ending: it started on 22 November and retains access until 22 December 2026 at 21:25:20 UTC. Renewal had been cancelled before this session, so a repeated cancellation returned `not_active` and the unavailable UI was expected; this is not an application defect. No new live sandbox subscription completed. A fresh sandbox account is still needed for new checkout, cancellation and recurring-grant acceptance.

The user configured Chrome correctly; the connected browser extension now provides authenticated Simulator access. All applicable Basic Launch and Fund automated checks passed on the current release. The game is still an unpublished draft; these results do not establish agreement acceptance, review submission, publication or Fund approval. The [self-review draft](jest-fund-self-review-draft.md) separates factual results from proposed commercial experiments and remaining work.

Jest confirmed current build `1.0.0-dev.20261126171348.54179b9a9da6.71ce691b`, version `01a218d9-ece2-71dd-ad32-b9ff1a979532`, ready and active at 17:14:32 UTC. Its [release evidence](evidence/jest-fund-guidance-2026-11-26.json) records the short-viewport guidance fix and passing production gate. It retains the [subscription balance refresh](evidence/jest-subscription-coin-refresh-2026-11-26.json) and [D1-D7 notification integration](evidence/jest-sdk-reminders-2026-11-26.json). Earlier Firefox gameplay observations apply to the preceding version; the current-version Profile retest and six sandbox purchases are recorded separately and do not certify every flow. Activation does not establish review approval; collect final acceptance evidence against this exact version.

[Audit snapshot](evidence/jest-growth-fund-audit-2026-11-26.json) records live catalog, asset and configuration observations against source `c3b3cf7749302994743bceb13f70b0c3e494ef01`. It predates the client SDK campaign; its missing-notification finding and manager-only implementation proposal are superseded below. The [3 November report](evidence/jest-submission-readiness-2026-11-03.html) is also historical and does not certify the current version.

## Authenticated Simulator on the current release

The [sanitized Simulator record](evidence/fund-hosted-2026-11-26/simulator-checklist-2026-11-26.json) captures Basic Launch **17/17**, Fund **6/6** and Recommended **3/4**, with “Eligible to apply” displayed. Native guest onboarding registration was dismissed successfully. A guest coin pack purchase awarded 250 coins, seeded incomplete recovery completed 1/1, and three Daily/Classic wins triggered the next native registration prompt. Registration preserved 7,835 coins and progress.

Seven D1–D7 reminders appeared three seconds after registration; Off removed all seven and On restored them. Simulated subscription cancellation left the balance unchanged; a successful retry awarded 3,400 coins, retained 11,235 after reload and hid the active offer. Keep and Confirm cancellation paths completed without extra coins. The Simulator revoked its mock entitlement on confirmation; this does not prove live billing-period behavior. A registered TOASTER win then awarded 25 coins.

SDK captures of gameplay, shop, Profile, settings, results and multiplayer were visually readable in Chrome. Browser data-URL downloads were blocked, so these observations have no local screenshot artifacts. More than ten minutes of desktop Simulator use remained usable, but cannot establish mobile loading or physical-device stability. One of three race invitations used fallback imagery and a transient race error occurred. Both are fixed in source: 48 race scenarios and six invite cases covering 30 PNG renders passed targeted checks. Those source changes are not yet represented by a verified new uploaded build, so the existing Simulator counts remain the recorded checkpoint.

Desktop Simulator device previews also passed on iPhone SE 375×667/Safari, Galaxy S25 360×780/Chrome and unfolded Galaxy Z Fold 7 984×1092/Installed presets. The clue, board, keyboard and navigation were visible; the multiplayer menu scrolled vertically. These are Chrome-hosted previews, not physical-device or Safari-engine tests.

## Current program

[Jest Fund II](https://about.jest.com/fund/) lists an Explore application deadline of 15 December 2026. Explore offers up to $5,000 in Jest Ads credits; publishing partnerships have separately negotiated funding up to $1 million per app. Apply through app review with the Fund checkbox selected. Acceptance and any required terms remain owner/platform decisions.

The [launch checklist](https://docs.jest.com/launch-checklist) separates Basic Launch, Fund and Recommended items. Both mandatory tracks must pass. The [Simulator guide](https://docs.jest.com/testing/simulator) explains that Waiting and Warn do not count as passes, and that Simulator behavior is mocked. Live sandbox and physical-device evidence is still needed.

## Requirement coverage

“Simulator pass” refers to the authenticated mock-host session on the exact current build. Live sandbox observations and physical-device requirements remain separate; none of these statuses implies manual Fund approval.

| Track / area | Current finding | Evidence or remaining work |
| --- | --- | --- |
| Basic: coherent gameplay | Core flows observed; source fixes await hosted retest | Guest onboarding, Daily/Classic completion and registered continuation ran on the recorded build. Race/referral fixes passed 48 race scenarios and six invite cases locally; a new uploaded-build retest is still required. Final quality is reviewed manually. |
| Basic: mobile loading | Current build budget passes; timing unverified | The notification artifact audit reports 3.99 MB total and 0.55 MB initial resources. Measure actual interaction under a documented standard mobile connection; size alone does not establish under-ten-second loading. |
| Basic: screen fit | Profile and three device previews passed; physical devices pending | Profile passed in a 424×452 frame. Simulator previews passed iPhone SE/Safari 375×667, Galaxy S25/Chrome 360×780 and unfolded Z Fold 7/Installed 984×1092, including visible gameplay controls and scrollable multiplayer menu. These desktop previews do not replace phone tests. |
| Basic: stability | Unverified | Run at least ten minutes on real iOS Safari and Android Chrome, including background/resume and repeated dialogs. |
| Basic: platform restrictions | Source/artifact checks passed | No third-party ads, external signup, install prompts or marketing CTAs found. Bundled notices remain local. |
| Basic: SDK / player | Applicable Simulator checks passed | The current session passed all 17 Basic checks. This is mock-host SDK evidence, not proof that every live path is error-free. |
| Basic: guest progress | Simulator continuity passed | Registration retained 7,835 coins and gameplay progress. Real sandbox guest migration and interrupted-save coverage remain separate checks. |
| Basic: registration | Simulator onboarding/cadence passed | Native guest prompts appeared after onboarding and the third Daily/Classic win. Dismissal preserved play; registered continuation retained progress. |
| Basic: custom Profile overlay | Applicable Simulator checks passed | Automatic reminder suppression and custom-message implementation remain in place. Native onboarding dismissal was observed; live SMS handoff is not certified by the mock host. |
| Basic: interactive-ready signal | Simulator check passed | The ready signal satisfied the automated check. Measure time to interaction in the real mobile host separately. |
| Basic: notification sequence | Simulator scheduling/consent passed | Seven D1–D7 schedules appeared three seconds after registration. Off removed seven and On restored seven. Live delivery and all failure/deletion paths remain separate evidence. |
| Basic: consumables | Six sandbox grants and Simulator guest/recovery passed | All six live sandbox packs delivered correct grants with reload persistence. Simulator guest pack 1 awarded 250 and seeded recovery completed 1/1. Live crash recovery and paid settlement remain unverified. |
| Basic: subscriptions | Simulator lifecycle passed; fresh live lifecycle pending | Simulator checkout awarded 3,400, reload retained balance and hid the active offer, and Keep/Confirm cancellation worked. The live ending subscription correctly retains access through 22 December; a fresh sandbox lifecycle and recurring grants still need verification. |
| Fund: contextual signup | Observed in Simulator | Native registration appeared after onboarding and the third completed Daily/Classic riddle. Manual reviewer acceptance remains separate. |
| Fund: notification content/assets | Automated Fund checks passed | Current D1–D7 copy/assets met all six applicable Fund checks. The campaign routes to Daily; actual message delivery and return-entry behavior still need live evidence. |
| Fund: monetization | Sandbox packs and mock subscription verified | Six sandbox packs delivered promised amounts; the Simulator subscription awarded 3,400. Fresh live subscription lifecycle and crash recovery remain pending. Current Premium timing has no missed-month accrual; zero-charge activity establishes no commercial performance. |
| Fund: screenshots | Six key screens visually checked in Simulator | Gameplay, shop, Profile, settings, results and multiplayer captures were readable. Browser downloads were blocked, so current captures have no local files; real-device coverage remains pending. |
| Recommended: referrals | Recorded total 3/4; source fix awaits hosted retest | The observed fallback-image issue and race error are fixed in source with targeted checks passing. Do not change the recorded Simulator score before testing the new upload. Live two-user arrival and exactly-once rewards remain unverified. |
| Recommended: dynamic reminders | Replacement and cancellation implemented | Stable identifiers refresh on a later visit or reconciliation on a new UTC day; consent changes, online recovery and visibility recovery reconcile the current state. Copy is a fixed Daily campaign, not personalized from gameplay progress. |

The most recent Console rejection describes matchmaking, friend-invite errors, delayed Next Level, duplicate loss text, redundant coin-pack text and a retry pause. Source fixes exist, but a new successful play-through is required to close that review evidence gap.

## Client notification implementation

Jest reminders use its [HTML5 notification API](https://docs.jest.com/sdk/html5/notifications) and Developer Console assets, as clarified in [notification ownership](../common/notifications/README.md). The existing account-preference callable and Android/Facebook notification manager retain their behavior and wire contracts; this integration requires no backend change.

The client now:

1. Mounts scheduling eagerly after registered identity, saved preferences and deletion state are committed. Guests and saved opt-outs are excluded.
2. Schedules the committed English-only D1-D7 campaign with seven distinct short bodies, the approved image and stable existing v3 identifiers. Validated entry payloads open Daily without a response reward.
3. Serializes preference changes with admitted operations, cancels all current and legacy identifiers on Off, and retains existing account-deletion cleanup. SDK failures do not roll back a successful account-preference save.
4. Retries incomplete operations within a bounded retry cycle, reconciles on online/visible recovery, and replaces schedules on a later visit or reconciliation on a new UTC day.
5. Validates campaign content through `check:jest-notifications` as part of `build:jest`. This static check cannot establish portal moderation or message delivery.

Keep the Simulator's server-to-server notification declaration off for this client SDK integration. Jest owns delivery and display. Follow [notification verification](jest-notification-testing.md) to gather exact-version evidence for registered/guest behavior, opt-out, deletion, failures, moderation, Daily routing and all seven days. Scheduling acceptance and actual delivery are separate observations.

## Acceptance work and commercial plan

Testing was explicitly authorized. Preserve the passing Simulator session and complete the remaining evidence against the same released version:

- Simulator: all applicable Basic and Fund checks passed on the recorded build. Preserve its session/SDK log; release the source race/referral fixes, retest that exact new version and recheck counts before any separately authorized submission.
- Live sandbox remaining work: interrupted purchase recovery, guest checkout, subscription lifecycle/cancellation/retry, guest identity continuity, two-user multiplayer/invitations and referral conversion. All six registered-player coin pack success paths and post-purchase reload persistence passed. Sandbox identity must remain confirmed before further transactions.
- Devices: real iPhone Safari and Android Chrome, documented load conditions, tall/wide/small viewports, installed mode, screenshot inspection and at least ten minutes of play with background/resume.

Local regression tests and the hosted desktop sandbox checks above ran under the user's explicit authorization. The automated Simulator gate passed; manual review, remaining live-platform coverage and the physical-device matrix remain incomplete. Review submission, publication, live sends and ad spending remain separate actions.

The earlier pre-checkout API snapshot returned zero product/subscription transactions, thirty empty retention cohorts and no ad campaigns. That historical transaction count is superseded by the six completed sandbox purchases above, all at zero charge and zero revenue. No paid conversion, retention or ROAS performance is established; these test transactions must not be presented as revenue. This does not by itself rule out an Explore application.

The proposed commercial validation plan uses the existing economy: measure tutorial completion, guest registration, first/third riddle completion, shop visits, paid conversion, repeat purchases and D1/D7/D30 retention by acquisition cohort. Track hint/attempt/skip usage to establish whether packs provide meaningful value without blocking free progression. Compare attributed net receipts after refunds and platform deductions with acquisition cost, using a stated cohort window and sample size. Scale only after observed economics support it. No fabricated retention, revenue or bid targets should enter the application.

## Configuration and checks

Live Console configuration has manual loading, portrait orientation, publisher RoobsWorld, six coin packs priced $0.99–$19.99 and a $4.99 monthly plan. The local manifest and validator now use the observed publisher, orientation and keywords, English listing copy, and `subscriptionSkus` for the enabled monthly plan. The obsolete sandbox-only label was removed and the local schema advanced to version 2. No live Console metadata was changed. Local assets and the revised description remain proposed inputs, not a claim of byte-for-byte listing parity. The validator checks repository consistency rather than querying live state.

The named notification image is approved and processed. Current logo and hero references are approved. The latest SDK event query and open-feedback query returned no entries; this does not replace runtime checks.

Live Chrome Team Settings showed the Application Development and Publishing Agreement and Acceptable Use Policy versions dated 2026-10-11 as **Signed**, each displayed as signed one month ago. This session accepted no agreement. The existing support email, logo and hero are configured. Final submission, manual review, Fund selection and any later per-app Fund Terms acceptance remain outstanding. [Review prerequisites](https://docs.jest.com/content-review-and-moderation)

The current Profile guidance release passed the production gate, including dependency/security audits, type checks, campaign content validation, build/artifact checks and W3C validation with zero findings. Jest confirmed its exact uploaded version ready and active; [release evidence](evidence/jest-fund-guidance-2026-11-26.json) records the source, archive and narrow desktop retest. Backend source/configuration remain unchanged and no backend was deployed. The limited hosted and local results above do not establish complete acceptance, actual notification delivery, Fund approval, review submission, publication, acceptance of terms or ad campaigns.
