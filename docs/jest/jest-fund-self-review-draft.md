# Riddle-Q — Jest Fund self-review draft

Draft only. This is not a completed self-review or a submitted Fund application. Replace the build details after the Profile tutorial layout fix is released, then rerun acceptance on that exact version.

## Build and evidence scope

- Last confirmed active build before the layout fix: `1.0.0-dev.20261126162520.f0a4ecbb034f.0e9adbba`.
- Version ID: `01a218ad-89d6-73c9-b0b9-44aaedbd5ef4`.
- Source commit: `f0a4ecbb034ffcf92bf494d2f51a89539b7a4040`.
- Application: Riddle-Q, `https://jest.com/g/riddle-q`.
- Evidence date: 26 November 2026.
- Final submitted version, source commit and Simulator session: **pending**.

The production gate passed type, artifact and HTML checks. Hosted observations are separate. Recent client releases did not change the backend.

## Suggested application summary

Riddle-Q is an English-language word game with Classic riddles, a Daily challenge and competitive races. Players solve using riddles and color clues, earn coins and save progress. Guest play is supported, with Jest registration after onboarding and at completed-riddle milestones.

The return loop combines Daily play with seven days of Jest notifications using distinct short copy, approved imagery and Daily routing. Saved opt-outs and deletion remove reminders. Implementation and asset approval were checked; delivery and final-version Simulator checks remain pending.

Coins buy hints, extra attempts and Classic skips. The observed catalog offers 250–7,000 coins across six packs priced $0.99–$19.99, plus $4.99 monthly Premium. Premium grants 3,400 coins on first verified activation, then one grant when active entitlement is reconciled at least 30 days after the last grant; missed paid months do not accrue. Grants remain server-authoritative, and the client refreshes balances after confirmed subscription grants. Live checkout settlement and recovery remain pending.

## Observations that may be reported now

- A registered sandbox player completed onboarding in Jest's hosted game.
- Three Classic riddles were completed, rewards were observed, and progress persisted.
- A race started, accepted answers and reached results. This alone does not establish a two-human invitation/referral journey.
- The screenshot provider produced gameplay, shop and Profile captures. Other key screens still need capture checks.
- A short-viewport Profile tutorial clipping issue was found. Its fix and exact-version retest must be recorded before claiming that layout passes.

Attach the corresponding browser evidence; these observations do not complete the whole checklist.

## Proposed commercial validation plan

The earlier Console audit returned zero transactions, empty retention cohorts and no ad campaigns. Conversion, retention and ROAS are unestablished. Sandbox purchases are not revenue.

After acceptance and an approved acquisition test, measure onboarding, registration, first/third-riddle completion, shop visits, paid conversion, repeat purchases and D1/D7/D30 retention by cohort. Compare acquisition costs with net receipts after refunds/platform deductions, stating the window, sample size and incomplete cohorts. Measure hint/attempt/skip use to understand purchase value.

Proposed experiments: clearer first-play guidance, truthful Daily reminder variants and clearer purchase benefits. Compare one change at a time with a documented baseline, preserving free progression. No invented targets or results. Spending, pricing changes and commercial terms need separate authorization.

## Items that cannot truthfully be checked complete yet

- All applicable automated Basic Launch and Fund checks: an authenticated Simulator run and its SDK log are pending. Warn and Waiting are not passes.
- Live sandbox checkout for all six packs, their promised grants, cancellation/error handling, interrupted purchase recovery, and no duplicate grants.
- Premium activation, initial grant, cancellation, restoration, recurring grant timing and the absence of duplicate offers. Do not promise billing-period catch-up under the current grant policy.
- Guest onboarding/registration/dismissal, the every-three-riddles prompt, guest shop availability, and guest-to-registered progress continuity on the final version.
- D1-D7 scheduling timing, images, opt-out, cancellation/recovery, return routing and actual Jest delivery.
- Two-user invitations/referrals and exactly-once rewards.
- Screenshot coverage on results, settings, multiplayer and overlays, plus the Profile tutorial retest after its fix.
- Under-ten-second interaction on a documented standard mobile connection; real iPhone Safari and Android Chrome; ten-plus-minute physical-device stability; tall/wide/small browser and installed layouts.
- Current team agreement/AUP acceptance, final submission prerequisites, reviewer manual verdicts, Fund selection and per-app Fund Terms acceptance.

## Submission handoff

Use the final active version in Jest's Simulator, complete every applicable Basic and Fund automated check, and attach the SDK session and factual notes. A recording is useful but optional. Keep the Fund option selected only when eligible. Do not submit this draft as an assertion that the pending items passed.

Jest Fund II Explore lists a 15 December 2026 application deadline and up to $5,000 in Jest Ads credits per app. There is no separate Explore application. Manual review and Fund selection remain Jest decisions; acceptance of Fund Terms follows acceptance before credits are issued.

Official references: [launch checklist](https://docs.jest.com/launch-checklist), [Simulator](https://docs.jest.com/testing/simulator), [sandbox testing](https://docs.jest.com/testing/sandbox), [review process](https://docs.jest.com/content-review-and-moderation), [Jest Fund II](https://about.jest.com/fund/).
