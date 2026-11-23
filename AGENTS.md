# Repository instructions

- The client is a React HTML5 game built with Vite for separate Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix candidate, Yahoo candidate and GameSnacks targets, plus one bare React Native Android app for Google Play.
- Platform-only source, tests, SDK adapters, views, device bridges, server integrations and release scripts belong in `platforms/native/<provider>` or `platforms/web/<provider>`. Android lives in `platforms/native/android`; every web target has its own `platforms/web/<provider>` root. Keep shared domain rules/controllers in `packages/core`, `packages/solo` and `packages/hosted`, shared browser UI/build infrastructure in `packages/web-game`, and shared authoritative server code in `firebase-functions`. Read `docs/platform-layout.md` before adding or moving platform code. Move callers and remove the old source location together; preserve one canonical implementation.
- Monitoring runs through the background Sentry worker in `tooling/sentry-worker`; the project has no monitoring or admin website. `@riddle-quest/portal` is the legacy CLI package name for the HTML5 game client only.
- The Android app is being brought to parity with the hosted Jest game natively, in the phases recorded in `docs/android-parity-plan.md` (ADR 0008). New gameplay, save, economy, commerce, race, identity and referral controllers belong in the shared packages. Native code adds views, storage, lifecycle, locale, and device bridges. Android uses the Firebase JS SDK, starts anonymously through `provisionAndroidAccount`, and links Google without changing the uid. New paid checkouts require a recoverable Google-linked account. See `docs/android-google-play-operations.md`.
- Keep native Google account selection, FCM, Play Integrity, Play Billing and Play Install Referrer in `platforms/native/android`. Use Install Referrer only to recover a pending entry link through the strict shared codec and explicit acceptance. Grants, subscription reconciliation and referral conversions remain server-authoritative and idempotent. Web artifacts must exclude native modules and another target's SDK. Do not add Expo, EAS, iOS, admin-panel, Clerk or payments outside Google Play to Android.
- Use the target-specific adapter for identity, purchases, referrals, notifications, preferences, social features, ads, and lifecycle signals. Rewarded and interstitial ads must remain Facebook-only and must never enter the Jest, Reddit, or YouTube artifact.
- Reddit browser traffic must remain same-origin under `/api/*`; only the Devvit server may call the single approved Firebase Functions host. Never bundle the Firebase browser SDK into the Reddit artifact or use Devvit Redis as the canonical global account/economy store.
- Keep the YouTube Playable self-contained: only the YouTube game API may be external, all content must ship in the bundle, and progress must use YouTube Playable Save after a successful load. Never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or other provider SDKs into the YouTube artifact.
- Keep Netflix and Yahoo candidate artifacts self-contained and provider-neutral until approved partner SDK contracts are available. Bundle all content, store progress locally, and never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK.
- Keep purchase grants, identity exchange, and referral rewards server-authoritative and idempotent.
- Jest ships in English only. Hint badges never award coins.
- When removing visible text, verify it is unused elsewhere and remove the corresponding key from every locale.
- When adding visible text, add it to every supported locale or reuse an existing translated key.
- Run tests and browser test harnesses only when the user explicitly requests them. Build the target artifacts needed for the requested change or upload.
- GitHub Actions stays manual-only with the explicit runner-usage confirmation gate. A push or merge does not authorize enabling workflows or spending hosted runner allowance. See `docs/github-actions-cost-controls.md`.
- After each requested code change, upload the current game to Jest and tell the user when the upload has completed processing. Activate a build, publish the game, or submit it for review only when explicitly requested.

## Branches

- `main` is the canonical source branch for all platforms and shared code. Integrate outstanding work into `main` before continuing platform development. `platforms/native/android` and `platforms/web/<provider>` are folders, not Git branch names.
- Confirm the current branch before editing. Commit and push each completed unit to `origin` as work progresses. Preserve unrelated edits and coordinate file ownership before parallel changes.
- Keep the existing `jest` deployment branch and `sentry` worker branch current with the completed `main` changes relevant to them. Upload to Jest only from `jest`. Worker automatic repair PRs retain their signed Jest base and deployment-authority checks; merge their completed changes back into `main`. Platform folders never create a second source-of-truth branch. Publication, review submission and other deployment actions retain their existing authorization requirements.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Grindhead/riddle-quest, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: the glossary is `CONTEXT.md` and decisions are in `docs/adr/`. See `docs/agents/domain.md`.
