# Repository instructions

- The client is a standard React HTML5 game built with Vite for separate Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix candidate, and Yahoo candidate targets, plus one bare React Native Android app in `packages/android` for Google Play.
- The Android app is self-contained like the YouTube Playable: it bundles the same content pack, stores progress in app-private storage, and shares all gameplay, save, economy, and controller logic through `@qwordly/core` and `@qwordly/solo`. Put new solo logic in `@qwordly/solo`, never in `packages/android` or `packages/portal/src/playable`; native code only adds views, storage, lifecycle, and locale. Never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK into the Android app. See `docs/android-google-play-operations.md`.
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

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Grindhead/riddle-quest, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: the glossary is `CONTEXT.md` and decisions are in `docs/adr/`. See `docs/agents/domain.md`.
