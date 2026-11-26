# Achievements

The shared display catalog lives in `src/progression/achievements/catalog`. Hosted web profiles and Android use its solo and race definitions. Offline hosts show the subset supported by `localAchievements.ts`, excluding purchases and multiplayer goals.

Names and requirements come from the existing achievement translations in every supported locale. Android also loads race translations. Offline browser builds load only solo achievement copy and statistics labels, without browser i18n state or provider SDKs. Icons have one display definition across clients.

## Progress and unlocks

`achievementPresentation.ts` projects local counters and builds the progress values used by native and browser collections. `hostedAchievementPlayer.ts` projects the trusted hosted profile. The collection counts recognized earned IDs once, places earned badges first, then orders remaining goals by their least-complete requirement. Equal progress preserves catalog order.

Most goals have one counter. Sharp Record displays both games played out of ten and win rate against 80%. Efficient Solver displays both wins out of ten and average guesses against a maximum of three. Missing averages stay unavailable instead of implying the requirement has been met. Nonfinite progress never reaches a rendered progress bar.

Recorded unlocks remain complete when a coin balance or performance statistic subsequently falls. Displayed progress does not grant an achievement. Hosted unlocks are evaluated by `firebase-functions/src/gameplay/achievements.ts` inside authoritative gameplay flows; offline unlocks are evaluated by `localAchievements.ts` and saved by the local authority. Race grants remain in the race settlement authority.

`achievementRewards.ts` counts each eligible ID once within a reward batch. Hint badges never award coins. Existing transactional receipts and durable unlock records remain responsible for preventing rewards across repeated operations.

## Browser completion presentation

After a win, the victory dialog waits for the matching authoritative completion receipt, then presents the level-up and every earned achievement in order. Next becomes available after the milestone queue finishes, including an empty queue. Hidden or paused games retain their unread milestones. Profile refreshes do not remove unlocks from the matching receipt just because the refreshed profile already contains them.

Auxiliary rewards arriving during victory wait until that presentation closes and survive loading the next riddle. The [November 26 Jest release evidence](../../jest/evidence/jest-completion-milestones-2026-11-26.json) records the production checks and exact active build. Updated reducer and component coverage was not run because tests and browser checks require an explicit request.

## Validation of the November 24, 2026 changes

- Shared, Android, Functions, Reddit and notification-manager type checks passed.
- Jest, Facebook, Reddit client, YouTube, Netflix, Yahoo and GameSnacks production builds and their artifact audits passed. The Reddit server build also passed.
- The Android release bundle and Functions production build passed.
- Added or updated regression coverage for compound requirements, missing and nonfinite counters, permanent unlock display, ordering, localized names, supported offline goals and duplicate reward IDs. These achievement tests and browser harnesses were not run because repository instructions require an explicit request.
- The combined `build:all-targets` command unexpectedly invoked Reddit's test suite through `build:package:from-client` and `validate`. That suite failed, including module resolution for `src/shared/redditCatalog.js`. Remaining builds were run individually without retrying tests. Reddit package validation is therefore incomplete.

The browser scripts `verify-achievement-localization-browser.mjs` and `verify-achievement-milestones-browser.mjs` follow the shared catalog, feature-owned styles and progress display. They remain opt-in. No game was uploaded, deployed or activated.
