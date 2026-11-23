# Additional achievement milestones — 2 October 2026

Added 12 solo achievements to the server-backed catalog and the self-contained YouTube, Netflix and Yahoo authorities. Shared provider-neutral thresholds live in `packages/core/src/game/achievementMilestones.ts`. The catalog now contains 61 achievements for server-backed targets and 53 for self-contained solo targets.

| Statistic | New milestones |
| --- | --- |
| Riddle wins | 10, 250 |
| Riddles played | 10, 250 |
| Classic progression | 5, 150 |
| Daily completions | 3, 365 |
| Daily wins | 10, 100 |
| Best daily win streak | 60 days |
| Experience | 10,000 XP |

The 150-level Classic milestone is reachable with the current 180-level self-contained bundle. Names and descriptions are translated in all 16 supported locales. The achievement UI's unlocked label and missing profile-details stylesheet are supplied as well.

Server-backed unlocks use the existing authoritative completion transaction and receipt. Client previews only include deterministic counters available in the completion projection; XP and streak unlocks arrive through the authoritative result. Self-contained targets continue to use their target-owned saves. Each new badge uses the existing 25-coin achievement reward rules; hints, purchases, referral grants and provider capabilities are unchanged by this work.

Verification completed:

- Core achievement tests: 5 passed. Missing stats, crossed milestones, existing unlocks and invalid counters covered.
- Portal achievement tests: 25 passed. All 12 local boundaries, duplicate exclusion, presentation projections, complete catalog serialization and reward durability covered.
- Server achievement tests: 57 passed. All 12 authoritative boundaries and a real-rule completion/replay transaction covered. The tenth win/play milestone pays both badges once and returns the original receipt on retry.
- Injected UI harness: all 12 new cards, translated descriptions, progress bars, unlocked state and fanfares passed in 16 languages at 390px and 1280px. No runtime errors or horizontal overflow.
- Actual artifact gameplay: YouTube, Netflix and Yahoo each earned the tenth-win/tenth-game badges and restored them after a save/reload at 390px and 1280px. YouTube uses the injected Game API load/save harness; candidates use local storage.
- Production builds and isolation audits passed for Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. The Devvit package build and contract checks also passed.
- Portal type checking, Functions build/module-cycle checks, file-size checks and whitespace checks passed.

Broader checks encountered unrelated changes in the shared workspace: the full portal suite passed 2,088 tests with two Firebase-region expectation failures; the broader server run passed 93 tests with two independent projection/supply-recovery failures. The TSDoc audit lists undocumented declarations outside the added milestone code. These failures are retained in the logs and were not hidden by weakening checks. No live deployment was performed.

Evidence is retained under `artifacts/achievements-expansion/`, including `core-tests.log`, `unit-tests.log`, `server-achievement-tests.log`, `browser.log`, `artifact-browser.log`, six `build-*.log` files, `reddit-package.log`, `server-build.log`, `portal-types.log`, `portal-all-tests.log`, `server-tests.log`, `tsdoc.log` and screenshots in `browser/`.

Reproduce achievement checks:

```bash
pnpm --filter @qwordly/core test --runInBand --runTestsByPath src/game/__tests__/achievementMilestones.test.ts src/game/__tests__/achievementRewards.test.ts
pnpm --filter @qwordly/portal test --runInBand --runTestsByPath src/play/__tests__/achievements.test.ts src/youtube/__tests__/achievementMilestones.test.ts
pnpm --dir firebase-functions test --runInBand --runTestsByPath src/__tests__/achievements.test.ts src/__tests__/completeGameTransaction.test.ts -t 'achievement|milestone|badge'
node packages/portal/scripts/verify-achievement-milestones-browser.mjs
PORTAL_BROWSER_TESTS=1 PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test --runInBand --runTestsByPath src/youtube/__tests__/achievementMilestones.jest-playwright.test.ts
```
