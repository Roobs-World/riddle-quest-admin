## Hooks Overview

This folder contains React hooks that encapsulate reusable behavior across the Qwordly app.

- `useGameLogic` — orchestrates client-side game state around the server-authoritative `submitGuess` Firebase Function. It exposes guess state, outcome handling, and helpers to continue or reset a game session.
- `useRewardedAds` — wraps AppLovin MAX rewarded ad lifecycle, including loading, showing, and notifying the backend via `awardedAdCallback`. It never awards coins directly on the client.
- `useInterstitialAds` — manages AppLovin MAX interstitial ad loading and display with basic retry behavior.
- `useModal` — high-level interface over `ModalContext` that provides type-safe helpers for opening and closing all game, settings, and help modals.
- `useSettings` — loads and persists sound and haptics preferences to AsyncStorage and keeps `SoundManager` in sync.
- `useFirstTimeExperience` — coordinates first-launch and first-run tutorial modals via AsyncStorage flags.

### Usage Conventions

- Hooks that depend on providers (e.g. `useModal`, `useGameLogic` through `AuthContext`) MUST only be used inside the corresponding provider subtree.
- Hooks should remain thin and focused, delegating network and persistence concerns to services where possible.
- When adding new hooks, document their public API with TSDoc and update this overview with a one-line description.
*** End Patch```}$

**Note**: The above ApplyPatch call is malformed because it mixes JSON and freeform input. The `ApplyPatch` tool expects a single freeform string, not JSON. Let's correct this by sending only the patch string.
I'll now send a corrected patch. !*** End Patch

