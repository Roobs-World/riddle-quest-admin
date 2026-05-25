## Hooks Overview

This folder contains React hooks that encapsulate reusable behavior across the Riddle Quest app.

- `useGameLogic` - orchestrates client-side game state around the server-authoritative `submitGuess` Firebase Function. It exposes guess state, outcome handling, and helpers to continue or reset a game session.
- `useModal` - high-level interface over `ModalContext` that provides type-safe helpers for opening and closing all game, settings, and help modals.
- `useSettings` - loads and persists sound and haptics preferences to AsyncStorage and keeps `SoundManager` in sync.
- `useFirstTimeExperience` - coordinates first-launch onboarding modals via AsyncStorage flags.

### Usage Conventions

- Hooks that depend on providers (for example, `useModal` and `useGameLogic` through `AuthContext`) must only be used inside the corresponding provider subtree.
- Hooks should remain thin and focused, delegating network and persistence concerns to services where possible.
- When adding new hooks, document their public API with TSDoc and update this overview with a one-line description.
