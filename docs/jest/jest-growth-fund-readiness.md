# Jest Fund readiness

Updated 26 November 2026 for the Jest client SDK notification campaign. **Fund acceptance remains unverified.** The D1-D7 implementation gap is addressed; the exact released artifact still needs hosted and physical-device acceptance.

Jest confirmed current build `1.0.0-dev.20261126162520.f0a4ecbb034f.0e9adbba`, version `01a218ad-89d6-73c9-b0b9-44aaedbd5ef4`, ready and active at 16:26:00 UTC. Its [release evidence](evidence/jest-subscription-coin-refresh-2026-11-26.json) records the subscription balance refresh and passing production gate. It includes the [D1-D7 notification integration](evidence/jest-sdk-reminders-2026-11-26.json). At the earlier audit, the app remained an unpublished draft with no revision in review; these releases made no publication or review submission. Activation does not establish review approval. Collect acceptance evidence against this exact current version.

[Audit snapshot](evidence/jest-growth-fund-audit-2026-11-26.json) records live catalog, asset and configuration observations against source `c3b3cf7749302994743bceb13f70b0c3e494ef01`. It predates the client SDK campaign; its missing-notification finding and manager-only implementation proposal are superseded below. The [3 November report](evidence/jest-submission-readiness-2026-11-03.html) is also historical and does not certify the current version.

## Current program

[Jest Fund II](https://about.jest.com/fund/) lists an Explore application deadline of 15 December 2026. Explore offers up to $5,000 in Jest Ads credits; publishing partnerships have separately negotiated funding up to $1 million per app. Apply through app review with the Fund checkbox selected. Acceptance and any required terms remain owner/platform decisions.

The [launch checklist](https://docs.jest.com/launch-checklist) separates Basic Launch, Fund and Recommended items. Both mandatory tracks must pass. The [Simulator guide](https://docs.jest.com/testing/simulator) explains that Waiting and Warn do not count as passes, and that Simulator behavior is mocked. Live sandbox and physical-device evidence is still needed.

## Requirement coverage

“Implemented” below means supported by source inspection, not a claimed Simulator pass. “Unverified” requires observation of the exact active artifact.

| Track / area | Current finding | Evidence or remaining work |
| --- | --- | --- |
| Basic: coherent gameplay | Unverified on current build | Existing fixes address the rejected duplicate loss/shop copy, immediate multiplayer error, bot fallback and delayed Next Level. Recheck the complete guest and registered journeys. |
| Basic: mobile loading | Current build budget passes; timing unverified | The notification artifact audit reports 3.99 MB total and 0.55 MB initial resources. Measure actual interaction under a documented standard mobile connection; size alone does not establish under-ten-second loading. |
| Basic: screen fit | Implemented; device checks pending | Full-frame shell, safe-area padding and resize handling exist. Check narrow, tall and wide phones, browser and installed modes, and the configured portrait orientation. |
| Basic: stability | Unverified | Run at least ten minutes on real iOS Safari and Android Chrome, including background/resume and repeated dialogs. |
| Basic: platform restrictions | Source/artifact checks passed | No third-party ads, external signup, install prompts or marketing CTAs found. Bundled notices remain local. |
| Basic: SDK / player | Implemented | SDK initialization disables duplicate login reminders; player identity is signed for the backend. Empty live error logs are not proof that every path ran without errors. |
| Basic: guest progress | Implemented | Stable player identity, SDK flush, serialized saves and authoritative reload are present. Verify continuity through registration, reload and interrupted saves. |
| Basic: registration | Implemented | Native login follows instructions and returning-player Play. Completed Daily/Classic wins 3, 6, 9 trigger it after completion presentation. Guests may dismiss; registered players are excluded. |
| Basic: custom Profile overlay | Implemented | Automatic reminders are disabled. The short ASCII custom registration message contains the required code placeholder. Verify the platform close control and cancellation. |
| Basic: interactive-ready signal | Implemented | Loading heartbeat and `markGameLoaded` are wired to playable readiness. Confirm timing in the real host. |
| Basic: notification sequence | Implemented; hosted acceptance pending | Registered, opted-in players receive D1-D7 SDK schedules after saved preferences and deletion state are ready. Stable identifiers, queued cancellation and bounded partial retries preserve consent. |
| Basic: consumables | Implemented; settlement unverified | Six live products exist. Guest checkout, signed grants before acknowledgement and paginated startup recovery are present. Exercise each product and interrupted recovery in sandbox. |
| Basic: subscriptions | Implemented; settlement unverified | The live monthly plan exists. Signed entitlement refresh, guest-visible offers, provider-owned signup gating and active-offer suppression are present. Verify activation, cancellation and restore. |
| Fund: contextual signup | Implemented | Onboarding and completed-riddle triggers are contextual rather than timed. Confirm the native UI on the active build. |
| Fund: notification content/assets | Implemented; delivery unverified | Seven distinct English ASCII bodies are at most 100 characters, use the approved `riddle-q-notification` image and route to Daily. The build content audit checks the campaign; real delivery remains to be observed. |
| Fund: monetization | Catalog present; acceptance pending | Coins purchase hints, attempts and Classic skips. Premium grants 3,400 coins on first verified activation, then one grant after at least 30 days when active entitlement is reconciled. This does not accrue every missed paid billing month. Verify all promises and transaction recovery. Commercial performance is not yet established. |
| Fund: screenshots | Implemented; current captures pending | The DOM screenshot provider captures visible game/dialog surfaces and excludes private fields. Verify gameplay, results, shop, Profile, settings and multiplayer. Older screenshots are historical. |
| Recommended: referrals | Implemented; two-user acceptance pending | Profile and race sharing include personalized images and validated entry routing. Signed referral conversion grants are server-authoritative. Verify actual invite arrival and exactly-once rewards. |
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

Run these against the same released version when test authorization is provided:

- Simulator: all applicable Basic Launch and Fund checks, registration and dismissal, catalogs, purchases/recovery, subscriptions, reminders, screenshots and referrals. Preserve the SDK log and exact version.
- Live sandbox: all six coin packs, subscription lifecycle, cancellation and retry, stable identity and saved progress, multiplayer/bot fallback, friend invitation and two-user referral conversion. Sandbox identity must be confirmed before transactions.
- Devices: real iPhone Safari and Android Chrome, documented load conditions, tall/wide/small viewports, installed mode, screenshot inspection and at least ten minutes of play with background/resume.

Repository instructions require explicit authorization before tests or browser harnesses. None ran for this audit. Review submission, publication, live sends and ad spending remain separate actions.

The API returned zero all-time product/subscription transactions, thirty empty retention cohorts and no ad campaigns. These observations establish no positive or negative ROAS. They are not a performance claim and do not by themselves rule out an Explore application.

The proposed commercial validation plan uses the existing economy: measure tutorial completion, guest registration, first/third riddle completion, shop visits, paid conversion, repeat purchases and D1/D7/D30 retention by acquisition cohort. Track hint/attempt/skip usage to establish whether packs provide meaningful value without blocking free progression. Compare attributed net receipts after refunds and platform deductions with acquisition cost, using a stated cohort window and sample size. Scale only after observed economics support it. No fabricated retention, revenue or bid targets should enter the application.

## Configuration and checks

Live Console configuration has manual loading, portrait orientation, publisher RoobsWorld, six coin packs priced $0.99–$19.99 and a $4.99 monthly plan. The local manifest and validator now use the observed publisher, orientation and keywords, English listing copy, and `subscriptionSkus` for the enabled monthly plan. The obsolete sandbox-only label was removed and the local schema advanced to version 2. No live Console metadata was changed. Local assets and the revised description remain proposed inputs, not a claim of byte-for-byte listing parity. The validator checks repository consistency rather than querying live state.

The named notification image is approved and processed. Current logo and hero references are approved. The latest SDK event query and open-feedback query returned no entries; this does not replace runtime checks.

Before submission, verify the team's signed Developer Agreement and Acceptable Use Policy in Team settings. The team-details API did not expose acceptance records, so this audit does not certify them. The existing support email, logo and hero are configured. Content moderation and the Fund's editorial/strategic-fit decision remain Jest's review responsibilities. [Review prerequisites](https://docs.jest.com/content-review-and-moderation)

The notification release passed the production gate, including dependency/security audits, type checks, campaign content validation, build/artifact checks and W3C validation with zero findings. Jest confirmed the exact uploaded version ready and active; [release evidence](evidence/jest-sdk-reminders-2026-11-26.json) records the source and archive. Backend source/configuration are unchanged and no backend was deployed. No test execution, hosted acceptance, actual notification delivery, Fund approval, review submission, publication, acceptance of terms or ad campaigns are claimed by this update.
