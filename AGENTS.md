# Repository instructions

- The client is a standard React HTML5 game built with Vite for separate Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix candidate, and Yahoo candidate targets, plus one bare React Native Android app in `packages/android` for Google Play.
- The Android app is being brought to parity with the hosted Jest game natively, in the phases recorded in `docs/android-parity-plan.md` (ADR 0008). It shares gameplay, save, economy, and controller logic through `@riddle-quest/core`, `@riddle-quest/solo`, and the hosted-play packages as they are extracted; put new logic in those shared packages, never in `packages/android` or `packages/portal`; native code only adds views, storage, lifecycle, locale, and device bridges. Android uses the Firebase JS SDK with anonymous auth provisioned by `provisionAndroidAccount`; never bundle another target's provider SDK, ads, or a purchase surface before the Phase 3 grant design exists. See `docs/android-google-play-operations.md`.
- Do not add Expo, EAS, iOS, admin-panel, Clerk, or native IAP code. Google Play Billing requires a separate server-authoritative grant design before any purchase surface appears on Android.
- Use the target-specific adapter for identity, purchases, referrals, notifications, preferences, social features, ads, and lifecycle signals. Rewarded and interstitial ads must remain Facebook-only and must never enter the Jest, Reddit, or YouTube artifact.
- Reddit browser traffic must remain same-origin under `/api/*`; only the Devvit server may call the single approved Firebase Functions host. Never bundle the Firebase browser SDK into the Reddit artifact or use Devvit Redis as the canonical global account/economy store.
- Keep the YouTube Playable self-contained: only the YouTube game API may be external, all content must ship in the bundle, and progress must use YouTube Playable Save after a successful load. Never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or other provider SDKs into the YouTube artifact.
- Keep Netflix and Yahoo candidate artifacts self-contained and provider-neutral until approved partner SDK contracts are available. Bundle all content, store progress locally, and never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK.
- Keep purchase grants, identity exchange, and referral rewards server-authoritative and idempotent.
- When removing visible text, verify it is unused elsewhere and remove the corresponding key from every locale.
- When adding visible text, add it to every supported locale or reuse an existing translated key.
- Run tests and browser test harnesses only when the user explicitly requests them. Build the target artifacts needed for the requested change or upload.
- After each requested code change, upload the current game to Jest and tell the user when the upload has completed processing. Activate a build, publish the game, or submit it for review only when explicitly requested.

## Branches

- `jest` owns the Jest web deployment: the web client, backend functions, and every Jest upload come from it. `android-react-native` owns the Android app in `packages/android` and the shared-package extractions it depends on; it is checked out as a separate worktree (`git worktree list` shows the path). Make each change on the branch that owns it, and upload to Jest only from `jest`.
- Before editing, confirm `git branch --show-current` is the owning branch; switch to the other worktree rather than committing to the wrong branch.
- Keep both branches current on GitHub: after each completed change, commit it on its branch and push to `origin` in the same turn, so neither local branch runs ahead of its remote. Merge `jest` into `android-react-native` whenever the web branch moves ahead; Android's shared-package changes reach Jest only through a merge into `jest`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Grindhead/riddle-quest, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: the glossary is `CONTEXT.md` and decisions are in `docs/adr/`. See `docs/agents/domain.md`.
