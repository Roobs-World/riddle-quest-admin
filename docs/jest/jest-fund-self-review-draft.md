# Riddle-Q — Jest Fund self-review draft

Integration note — 27 November 2026: this `main`-into-`jest` merge has not been built, uploaded or run through hosted acceptance. The latest recorded live verification is [the returning-guest release](evidence/returning-guest-registration-2026-11-26.json), version `01a219c2-33c8-7139-928a-db76b271ee36`, source `f5d18e58c2cc`, ready and active on 26 November at 21:28:14 UTC. No new Jest status query was made for this merge. Its Simulator acceptance was not run. The Basic 17/17, Fund 6/6 and Recommended 3/4 results below are historical evidence for guidance build `54179b9a9da6`, not acceptance of the later main releases or this integration. Nothing has been submitted or awarded.

Current notification ownership follows [manager-owned platform delivery](../common/notifications/platform-delivery.md#jest) and [notification verification](jest-notification-testing.md): the manager supplies the seven-day plan; Firebase verifies identity and consent; the Jest adapter schedules it through the SDK. The later [Growth Fund release](evidence/growth-fund-fixes-2026-11-26.json) deployed the manager handoff with v4 identifiers and no gameplay entry payload. Earlier Daily-routing/v3 observations below remain historical. The merge also retains generation-based account reset as described in [production operations](jest-html5-operations.md).

## Historical review checkpoint — 26 November 2026

Everything below records the stated November 26 builds and observations. References to “current” or “new” within this checkpoint refer to the invitation release at 17:55 UTC, before the later main releases.

Draft only; nothing has been submitted. The preceding guidance build `54179b9a9da6` passed all automated Basic Launch (17/17) and Fund (6/6) checks and displayed “Eligible to apply.” The newly active race/invitation build `47bcd335e3d9` awaits its exact-version hosted retest. Manual review, remaining live-platform coverage and physical-device acceptance are pending. The recorded Recommended score is 3/4. Referral/race fixes passed targeted checks and are now released; exact-version hosted retesting is pending.

## Build and evidence scope

- Current ready, active build: `1.0.0-dev.20261126175458.47bcd335e3d9.e99db118`.
- Version ID: `01a218ff-992c-7775-9adc-7ac38d761c30`.
- Source commit: `47bcd335e3d96dc707b2d945a9aeea13cc7affbc`.
- Activated: 26 November 2026 at 17:55:41 UTC.
- Release evidence: [Race and invitation fixes](evidence/jest-fund-invitations-2026-11-26.json).
- Application: Riddle-Q, `https://jest.com/g/riddle-q`.
- Evidence date: 26 November 2026.
- Prior guidance-build authenticated Simulator baseline: **Basic 17/17 and Fund 6/6 passed**; [sanitized record](evidence/fund-hosted-2026-11-26/simulator-checklist-2026-11-26.json). Submission: **not made**.
- Six live sandbox coin pack purchases: correct grants and reload persistence verified. Mock-host subscription and seeded recovery passed; live subscription checkout/lifecycle and real interrupted recovery remain pending.

The production gate passed type, artifact and HTML checks. Hosted observations are separate. Recent client releases did not change the backend.

## Historical application-summary draft (update before submission)

Riddle-Q is an English-language word game with Classic riddles, a Daily challenge and competitive races. Players solve using riddles and color clues, earn coins and save progress. Guest play is supported, with Jest registration after onboarding and at completed-riddle milestones.

The return loop combines Daily play with seven days of Jest notifications using distinct short copy, approved imagery and Daily routing. Saved opt-outs and deletion remove reminders. Implementation, asset approval and guidance-build Simulator checks passed; seven reminders appeared three seconds after registration, and Off/On removed/restored them. Actual delivery remains unverified.

Coins buy hints, extra attempts and Classic skips. The observed catalog offers 250–7,000 coins across six packs priced $0.99–$19.99, plus $4.99 monthly Premium. Premium grants 3,400 coins on first verified activation, then one grant when active entitlement is reconciled at least 30 days after the last grant; missed paid months do not accrue. Grants remain server-authoritative, and the client refreshes balances after confirmed subscription grants. All six coin pack success paths passed in zero-charge live sandbox checkout. The Simulator verified a 3,400-coin subscription grant, reload persistence, cancellation and seeded purchase recovery. Live subscription checkout/lifecycle and real interrupted recovery remain pending; these tests do not establish paid settlement.

## Observations that may be reported now

The initial onboarding, Classic, race and screenshot observations below apply to preceding version `01a218ad-89d6-73c9-b0b9-44aaedbd5ef4`. The identified Profile retest, six live sandbox coin pack purchases and authenticated Simulator run used guidance version `01a218d9-ece2-71dd-ad32-b9ff1a979532`; those results do not certify the newly active invitation build. Their scopes remain distinct.

- A registered sandbox player completed onboarding in Jest's hosted game.
- Three Classic riddles were completed, rewards were observed, and progress persisted.
- A race started, accepted answers and reached results. This alone does not establish a two-human invitation/referral journey.
- The preceding live sandbox screenshot provider produced gameplay, shop and Profile captures. Guidance-build Simulator screenshot coverage is recorded below.
- Guidance build: Profile tutorial steps 1–9 were replayed in Firefox with a 500×682 shell and 424×452 game frame. Inspected cards, including the final Your Treasure Chest step, showed their title, copy and Got it action; Enter completed the tutorial. The 4,560-coin balance persisted. This verifies the reported clipping fix, not all mobile layouts.

- Guidance build: all six coin packs completed and awarded their displayed amounts (7,000, 3,400, 1,600, 900, 550 and 250). Balance rose from 4,560 to 18,260 and survived reload with the same next Classic SNAIL riddle. Jest records six complete sandbox transactions with zero credits and revenue. [Purchase evidence](evidence/fund-hosted-2026-11-26/sandbox-purchases.json).
- Guidance build: exact-account verification confirmed Premium renewal was cancelled before this session. The ending subscription retains access until 22 December 2026 at 21:25:20 UTC and correctly hides duplicate offers. Repeated cancellation was unavailable as expected; this is not an application bug. No new live sandbox subscription completed.

- Guidance-build authenticated Simulator: native guest onboarding prompt/dismissal, guest pack 1 (+250), seeded incomplete purchase completion (1/1), and Daily/Classic wins triggered the native prompt after three riddles. Registration retained 7,835 coins and progress.
- Guidance-build Simulator: seven D1–D7 reminders appeared three seconds after registration; Off removed all seven and On restored them. Subscription checkout dismissal preserved 7,835 coins, successful retry added 3,400, reload retained 11,235 and hid the active offer, and Keep/Confirm cancellation completed without extra coins. The mock host revoked entitlement immediately; that is not evidence of live billing-period timing.
- Guidance-build Simulator: gameplay, shop, Profile, settings, results and multiplayer SDK captures were visually readable. Data-URL downloads were blocked, so no local capture files are claimed. More than ten minutes remained usable on desktop; no mobile performance conclusion follows.

- Guidance-build Simulator device previews: iPhone SE 375×667/Safari, Galaxy S25 360×780/Chrome and unfolded Z Fold 7 984×1092/Installed showed the clue, board, keyboard and navigation, with vertical scrolling in the multiplayer menu. These Chrome-hosted previews do not prove physical-device or Safari-engine behavior.
- Live Team Settings: the Developer Agreement and AUP versions dated 2026-10-11 were already Signed, displayed as one month ago. No agreement was accepted during this session.
- Released follow-up: race/referral fixes passed 48 race scenarios and six invite cases containing 30 PNG renders. Those fixes are active in the new invitation build and need its exact-version retest; the earlier Simulator score remains 3/4 Recommended.

Attach the session and factual evidence. Passing the automated checklist enables an application; it is not manual Fund acceptance.

## Proposed commercial validation plan

The earlier pre-checkout Console audit returned zero transactions, empty retention cohorts and no ad campaigns. Six later completed sandbox purchases have zero charge and revenue. They supersede the historical transaction count but establish no paid conversion, retention or ROAS performance.

After acceptance and an approved acquisition test, measure onboarding, registration, first/third-riddle completion, shop visits, paid conversion, repeat purchases and D1/D7/D30 retention by cohort. Compare acquisition costs with net receipts after refunds/platform deductions, stating the window, sample size and incomplete cohorts. Measure hint/attempt/skip use to understand purchase value.

Proposed experiments: clearer first-play guidance, truthful Daily reminder variants and clearer purchase benefits. Compare one change at a time with a documented baseline, preserving free progression. No invented targets or results. Spending, pricing changes and commercial terms need separate authorization.

## Items that cannot truthfully be checked complete yet

- Manual Fund review and final session handoff. All applicable automated Basic/Fund checks passed; preserve the SDK session and recheck counts before submission or after any build change.
- Live interrupted-purchase recovery, retry duplicate prevention and broader failure handling. Simulator seeded recovery and guest checkout passed; all six live sandbox packs and reload persistence passed.
- Live sandbox Premium activation, grant, cancellation, restoration and recurring timing. An existing inactive Sandbox User reached the live Stripe checkout at pay.jest.com, showing £0.00/month. It requires a full name and US shipping address; the empty form was rejected and no subscription was created. At that checkpoint, the £0.00/month checkout was left open in Firefox for manual entry; its current browser state has not been rechecked, and live activation, grant, cancellation and recurring-grant checks remain pending. Mock checkout/grant/reload/cancellation and existing live ending-entitlement behavior passed. Do not promise billing-period catch-up under the current grant policy.
- Live-host guest registration and migration continuity. Guidance-build Simulator onboarding/dismissal, every-three-riddles prompt, guest purchase and registration continuity passed.
- Live notification delivery/entry routing and remaining failure/deletion paths. Simulator D1–D7 timing/content/assets and Off/On consent passed.
- Retest the released race/referral fixes on the exact new build, then recheck Recommended status. The recorded checkpoint remains 3/4. Complete live two-user arrival and exactly-once rewards.
- Physical-device screenshot/layout coverage. Six key screen captures, narrow Profile guidance and three mobile device presets passed desktop visual checks; these do not certify real phones.
- Under-ten-second interaction on a documented standard mobile connection; real iPhone Safari and Android Chrome; ten-plus-minute physical-device stability; tall/wide/small browser and installed layouts.
- Final submission prerequisites, reviewer manual verdicts, Fund selection and any per-app Fund Terms acceptance. Team agreement/AUP signed status was verified in live Settings; this session accepted neither.

## Submission handoff

The preceding guidance version was eligible to apply after passing every applicable automated Basic and Fund check. Preserve that baseline SDK session, retest the newly active invitation version, complete the remaining acceptance evidence and record the final counts on that exact version. A recording is useful but optional. Any separately authorized submission must retain truthful pending-item disclosures; this draft does not assert those items passed.

Jest Fund II Explore lists a 15 December 2026 application deadline and up to $5,000 in Jest Ads credits per app. There is no separate Explore application. Manual review and Fund selection remain Jest decisions; acceptance of Fund Terms follows acceptance before credits are issued.

Official references: [launch checklist](https://docs.jest.com/launch-checklist), [Simulator](https://docs.jest.com/testing/simulator), [sandbox testing](https://docs.jest.com/testing/sandbox), [review process](https://docs.jest.com/content-review-and-moderation), [Jest Fund II](https://about.jest.com/fund/).
