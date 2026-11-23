# Functions source layout

Shared authoritative source lives in `firebase-functions/src`. Provider server integrations live in their corresponding `platforms/` folders. The [architecture guide](../architecture/functions-source-layout.md) explains the responsibility layout and directory limit.

| Source | Responsibility |
| --- | --- |
| `index.ts` | Admin initialization and deployed Function export composition |
| `gameplay/callables`, `gameplay/sessions`, `gameplay/content` | Single-player request boundaries, authority and recovery, and riddle lookup |
| `race/api`, `race/access`, `race/matchmaking` | Race request boundaries, eligibility, rollout, and opponent selection |
| `race/content`, `race/runs` | Content/deck preparation and authoritative run state |
| `race/invitations`, `race/live`, `race/notifications` | Invitations, live play, and shared notification orchestration |
| `race/settlement`, `race/delivery`, `race/recovery`, `race/privacy` | Awards, durable delivery, replay and maintenance, and privacy-safe projections |
| `daily`, `riddles` | Daily challenges, scheduling, content generation, and supply |
| `profile`, `profile/accountDeletion` | Profile updates, username reservations, and account cleanup |
| `presence`, `social` | Shared presence, consent, and rival safety |
| `shared`, `validation` | Runtime infrastructure, security, telemetry, shared helpers, and server contracts |
| `__tests__` | Existing unit and emulator-backed tests and fixtures, unchanged in location |

The real race orchestration services remain at the race root. Gameplay's account-data, achievement, and leaderboard implementations remain at its root. These modules contain behavior rather than compatibility re-exports.

`firebase-functions/scripts` groups production tools under `build`, `content`, `races`, `maintenance`, `runtime`, `deploy`, and `verification`. Backend test configuration lives in `firebase-functions/config/testing`.

`index.ts` keeps its exported Function names. The compiled deployment entry remains `lib/firebase-functions/src/index.js`. Build staging, CommonJS emission, and Node 22 remain part of the deployment contract.

Project-owned directories allow at most 20 direct non-test files. Tests, installed dependencies, and generated outputs are exempt. Existing tests stay in place and import the new canonical production paths.
