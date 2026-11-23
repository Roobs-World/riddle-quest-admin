# Repository instructions

- The client is a React HTML5 game built with Vite for separate Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix candidate, Yahoo candidate and GameSnacks targets, plus one bare React Native Android app for Google Play.
- Store project documentation in `docs/<platform>/` for platform modules and `docs/common/<module>/` for shared modules and operations. Keep evidence and documentation assets with their module, update links and tooling paths when moving documents, and use `docs/README.md` as the index. Root discovery files and agent tooling retain their required locations.
- Platform-only source, tests, SDK adapters, views, device bridges, server integrations and release scripts belong in `platforms/native/<provider>` or `platforms/web/<provider>`. Android lives in `platforms/native/android`; every web target has its own `platforms/web/<provider>` root. Organise shared source by feature under `src`, with components, controllers, contracts, rules and runtime adapters inside the feature that owns them. Feature roots include `gameplay`, `races`, `accounts`, `commerce`, `progression` and `content`; shared browser build tooling lives in `scripts/web`. These are ordinary folders using root dependencies and configuration. Shared authoritative server code stays in `firebase-functions`. Read `docs/common/architecture/platform-layout.md` before adding or moving platform code. Move callers and remove the old source location together; preserve one canonical implementation.
- Monitoring runs through the background Sentry worker in `tooling/sentry-worker`; the project has no monitoring or admin website. Run shared game commands from the root project.
- The Android app is being brought to parity with the hosted Jest game natively, in the phases recorded in `docs/android/android-parity-plan.md` (ADR 0008). Gameplay, save, economy, commerce, race, identity and referral controllers used by multiple platforms belong in the shared `src` folders. Android-only controllers, views, storage, lifecycle, locale and device bridges belong in its platform folder. Android uses the Firebase JS SDK, starts anonymously through `provisionAndroidAccount`, and links Google without changing the uid. New paid checkouts require a recoverable Google-linked account. See `docs/android/android-google-play-operations.md`.
- Keep native Google account selection, FCM, Play Integrity, Play Billing and Play Install Referrer in `platforms/native/android`. Use Install Referrer only to recover a pending entry link through the strict shared codec and explicit acceptance. Grants, subscription reconciliation and referral conversions remain server-authoritative and idempotent. Web artifacts must exclude native modules and another target's SDK. Do not add Expo, EAS, iOS, admin-panel, Clerk or payments outside Google Play to Android.
- Use the target-specific adapter for identity, purchases, referrals, notifications, preferences, social features, ads, and lifecycle signals. Rewarded and interstitial ads must remain Facebook-only and must never enter the Jest, Reddit, or YouTube artifact.
- Reddit browser traffic must remain same-origin under `/api/*`; only the Devvit server may call the single approved Firebase Functions host. Never bundle the Firebase browser SDK into the Reddit artifact or use Devvit Redis as the canonical global account/economy store.
- Keep the YouTube Playable self-contained: only the YouTube game API may be external, all content must ship in the bundle, and progress must use YouTube Playable Save after a successful load. Never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or other provider SDKs into the YouTube artifact.
- Keep Netflix and Yahoo candidate artifacts self-contained and provider-neutral until approved partner SDK contracts are available. Bundle all content, store progress locally, and never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK.
- Keep purchase grants, identity exchange, and referral rewards server-authoritative and idempotent.
- Jest ships in English only. Hint badges never award coins.
- When removing visible text, verify it is unused elsewhere and remove the corresponding key from every locale.
- When adding visible text, add it to every supported locale or reuse an existing translated key.
- Keep each project-owned folder under `firebase-functions` at no more than 20 direct files. Test files and test folders are exempt; installed dependencies and generated output are excluded. Run `pnpm check:functions-layout` after changing the layout.
- Run tests and browser test harnesses only when the user explicitly requests them. Build the target artifacts needed for the requested change or upload.
- GitHub Actions stays manual-only with the explicit runner-usage confirmation gate. A push or merge does not authorize enabling workflows or spending hosted runner allowance. See `docs/common/development/github-actions-cost-controls.md`.
- Game uploads are manual-only and require an explicit user request. File changes, commits, pushes, builds and completed code changes do not authorize an upload. After a requested Jest upload, tell the user when processing has completed. Activate a build, publish the game, or submit it for review only when explicitly requested.

## Branches

- Use `main` for all development, releases, Jest uploads and monitoring repairs. Platform ownership follows `platforms/native/android` and `platforms/web/<provider>` folders. There are no separate maintained platform, deployment or worker branches.
- Confirm `git branch --show-current` returns `main` before editing or releasing. Commit and push each completed unit to `origin/main` as work progresses. Preserve unrelated edits and coordinate file ownership before parallel changes.
- Monitoring repair PRs target `main` and retain signed main-base, deployed-version, exact-head and deployment-authority checks. Release authorization requirements still apply to activation, publication, review submission and deployment. Historical branch/worktree records do not change the current main-only policy.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Grindhead/riddle-quest, via the `gh` CLI. See `docs/common/agents/issue-tracker.md`.

### Triage labels

The default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/common/agents/triage-labels.md`.

### Domain docs

Single-context: the glossary is `docs/common/core/CONTEXT.md` and decisions are in `docs/common/architecture/adr/`. See `docs/common/agents/domain.md`.
