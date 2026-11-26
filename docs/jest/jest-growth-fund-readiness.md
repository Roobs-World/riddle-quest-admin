# Jest Fund readiness

Reviewed 26 November 2026 against source `c3b3cf7749302994743bceb13f70b0c3e494ef01` and the live Developer Console. **Not ready for Fund submission.** Jest notification delivery is missing, and the current artifact still needs hosted and device acceptance.

The active build is `1.0.0-dev.20261126143608.4ed687dbcd8a.3e83d0bb`, version `01a21849-8d19-778a-a400-0934df0bddc0`. Its [release evidence](evidence/jest-native-guest-login-2026-11-26.json) confirms ready/active status and the production gate. The app remains an unpublished draft with no revision in review. Activation does not establish review approval.

[Audit snapshot](evidence/jest-growth-fund-audit-2026-11-26.json) records live catalog, asset and configuration observations. The [3 November report](evidence/jest-submission-readiness-2026-11-03.html) is historical and does not certify this version.

## Current program

[Jest Fund II](https://about.jest.com/fund/) lists an Explore application deadline of 15 December 2026. Explore offers up to $5,000 in Jest Ads credits; publishing partnerships have separately negotiated funding up to $1 million per app. Apply through app review with the Fund checkbox selected. Acceptance and any required terms remain owner/platform decisions.

The [launch checklist](https://docs.jest.com/launch-checklist) separates Basic Launch, Fund and Recommended items. Both mandatory tracks must pass. The [Simulator guide](https://docs.jest.com/testing/simulator) explains that Waiting and Warn do not count as passes, and that Simulator behavior is mocked. Live sandbox and physical-device evidence is still needed.

## Requirement coverage

“Implemented” below means supported by source inspection, not a claimed Simulator pass. “Unverified” requires observation of the exact active artifact.

| Track / area | Current finding | Evidence or remaining work |
| --- | --- | --- |
| Basic: coherent gameplay | Unverified on current build | Existing fixes address the rejected duplicate loss/shop copy, immediate multiplayer error, bot fallback and delayed Next Level. Recheck the complete guest and registered journeys. |
| Basic: mobile loading | Build budget passes; timing unverified | Existing artifact audit reports 3.99 MB total and 0.54 MB initial resources. Measure actual interaction under a documented standard mobile connection; size alone does not establish under-ten-second loading. |
| Basic: screen fit | Implemented; device checks pending | Full-frame shell, safe-area padding and resize handling exist. Check narrow, tall and wide phones, browser and installed modes, and the configured portrait orientation. |
| Basic: stability | Unverified | Run at least ten minutes on real iOS Safari and Android Chrome, including background/resume and repeated dialogs. |
| Basic: platform restrictions | Source/artifact checks passed | No third-party ads, external signup, install prompts or marketing CTAs found. Bundled notices remain local. |
| Basic: SDK / player | Implemented | SDK initialization disables duplicate login reminders; player identity is signed for the backend. Empty live error logs are not proof that every path ran without errors. |
| Basic: guest progress | Implemented | Stable player identity, SDK flush, serialized saves and authoritative reload are present. Verify continuity through registration, reload and interrupted saves. |
| Basic: registration | Implemented | Native login follows instructions and returning-player Play. Completed Daily/Classic wins 3, 6, 9 trigger it after completion presentation. Guests may dismiss; registered players are excluded. |
| Basic: custom Profile overlay | Implemented | Automatic reminders are disabled. The short ASCII custom registration message contains the required code placeholder. Verify the platform close control and cancellation. |
| Basic: interactive-ready signal | Implemented | Loading heartbeat and `markGameLoaded` are wired to playable readiness. Confirm timing in the real host. |
| Basic: notification sequence | **Missing** | No current D1-D7 sequence is scheduled. The frontend saves consent and removes legacy reminders; the manager has no Jest delivery transport. |
| Basic: consumables | Implemented; settlement unverified | Six live products exist. Guest checkout, signed grants before acknowledgement and paginated startup recovery are present. Exercise each product and interrupted recovery in sandbox. |
| Basic: subscriptions | Implemented; settlement unverified | The live monthly plan exists. Signed entitlement refresh, guest-visible offers, provider-owned signup gating and active-offer suppression are present. Verify activation, cancellation and restore. |
| Fund: contextual signup | Implemented | Onboarding and completed-riddle triggers are contextual rather than timed. Confirm the native UI on the active build. |
| Fund: notification content/assets | **Missing delivery** | Approved `riddle-q-notification` asset exists. The manager still needs a varied seven-day campaign with bodies no longer than 100 characters and real Daily/puzzle callbacks. |
| Fund: monetization | Catalog present; acceptance pending | Coins purchase hints, attempts and Classic skips; Premium grants coins periodically. Verify all promises and transaction recovery. Commercial performance is not yet established. |
| Fund: screenshots | Implemented; current captures pending | The DOM screenshot provider captures visible game/dialog surfaces and excludes private fields. Verify gameplay, results, shop, Profile, settings and multiplayer. Older screenshots are historical. |
| Recommended: referrals | Implemented; two-user acceptance pending | Profile and race sharing include personalized images and validated entry routing. Signed referral conversion grants are server-authoritative. Verify actual invite arrival and exactly-once rewards. |
| Recommended: dynamic reminders | Missing with delivery | The manager must own replacement/cancellation policy and identifiers. |

The most recent Console rejection describes matchmaking, friend-invite errors, delayed Next Level, duplicate loss text, redundant coin-pack text and a retry pause. Source fixes exist, but a new successful play-through is required to close that review evidence gap.

## Notification work needed

The relevant boundary is explicit in [notification ownership](../common/notifications/README.md). `platforms/web/jest/src/notifications/useJestNotifications.ts` only cancels legacy schedules; `notification-manager/server/delivery.ts` excludes transports other than Android and Facebook. `JestSdkPlatform.scheduleNotification` has no production caller. Saving an On preference does not create a delivery route.

Implement a manager-owned Jest integration before claiming compliance:

1. Define the verified Jest recipient and consent boundary in the manager/backend. Retain account deletion and opt-out cancellation.
2. Have the manager author a D1-D7 campaign with stable identifiers, varied short copy, approved assets and real return destinations. No reward is granted merely for responding to a notification.
3. Select a documented transport. A server-to-server Jest API needs its current supported contract and credentials verified before implementation. A manager-to-SDK transport would need an explicit exception to the current registration-only frontend contract; do not silently restore game-authored schedules.
4. Schedule promptly after registered identity is established; replace existing identifiers on relevant progress changes. Record platform acceptance separately from actual delivery.
5. Verify registered/guest behavior, opt-out, account deletion, failures, moderation, return routing and all seven days. Live messages require explicit authorization.

The Simulator's server-to-server declaration is valid only after a working backend delivery integration exists. It is not a way to bypass the missing implementation. [Notification API](https://docs.jest.com/sdk/html5/notifications)

This work changes the manager/backend, which the user previously excluded. That boundary must be expanded explicitly before implementation. No backend code, campaign, schedule or transport was changed by this audit.

## Acceptance work and commercial plan

Run these against the same version after the notification gap is fixed:

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

For this audit, the existing artifact audit, local release-manifest check and security audit passed. The immediately preceding release passed the production gate and W3C check. No new game build or upload was necessary for this documentation update. No review was submitted, no publication changed, no terms were accepted and no messages or ad campaigns were sent.
