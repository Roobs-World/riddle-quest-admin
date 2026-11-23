# Functions source layout

- `daily/` — daily challenge reads, generation, streaks, and scheduler.
- `gameplay/` — authoritative game actions, player data, achievements, and leaderboard.
- `jest/` — signed Jest identity, purchases, subscriptions, referrals, and trusted product catalog.
- `profile/` — username and avatar updates.
- `race/` — Race to 10 callables, rollout, content, and scoring.
- `riddles/` — riddle generation, quality, storage, and supply management.
- `shared/` — Firebase Admin initialization, constants, and observability.
- `utils/` — small reusable utilities.
- `validation/` — callable and Firestore schemas.
- `__tests__/` — unit and emulator-backed integration tests.

`index.ts` is the Firebase deployment entrypoint. Keep it declarative and preserve its exported function names because Firebase uses those names as deployed API contracts.

Domain modules may import `shared/` and `validation/`. Prefer importing another domain's public module directly over adding pass-through files at the source root.
