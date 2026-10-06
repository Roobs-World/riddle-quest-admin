# Repository instructions

- The client is a standard React HTML5 game built with Vite for separate Jest, Facebook Instant Games, Reddit Devvit Web, YouTube Playables, Netflix candidate, and Yahoo candidate targets.
- Do not add React Native, Expo, EAS, Android, iOS, native store, admin-panel, Clerk, or native IAP code.
- Use the target-specific adapter for identity, purchases, referrals, notifications, preferences, social features, ads, and lifecycle signals. Rewarded and interstitial ads must remain Facebook-only and must never enter the Jest, Reddit, or YouTube artifact.
- Reddit browser traffic must remain same-origin under `/api/*`; only the Devvit server may call the single approved Firebase Functions host. Never bundle the Firebase browser SDK into the Reddit artifact or use Devvit Redis as the canonical global account/economy store.
- Keep the YouTube Playable self-contained: only the YouTube game API may be external, all content must ship in the bundle, and progress must use YouTube Playable Save after a successful load. Never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or other provider SDKs into the YouTube artifact.
- Keep Netflix and Yahoo candidate artifacts self-contained and provider-neutral until approved partner SDK contracts are available. Bundle all content, store progress locally, and never bundle Firebase, analytics, ads, identity, purchases, sharing, multiplayer, or another target's SDK.
- Keep purchase grants, identity exchange, and referral rewards server-authoritative and idempotent.
- When removing visible text, verify it is unused elsewhere and remove the corresponding key from every locale.
- When adding visible text, add it to every supported locale or reuse an existing translated key.
- Verify UI changes in injected browser harnesses and build all six isolated target artifacts before handoff.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Grindhead/riddle-quest, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: the glossary is `CONTEXT.md` and decisions are in `docs/adr/`. See `docs/agents/domain.md`.
