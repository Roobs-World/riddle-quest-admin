## Contexts Overview

This folder contains React context providers and hooks that expose shared application state.

- `AuthContext` — central source of truth for authentication status, player data, current riddle, and active `GameMode`. It listens to Firebase Auth, initializes user documents and riddles, and surfaces helpers such as `updatePlayerClassicIndex`, `updatePlayerData`, and `fetchCurrentRiddle`.
- `ModalContext` (used via `useModal`) — stores the active modal stack and provides the low-level primitives that the modal system uses to show, hide, and update modals.

### Usage Conventions

- Always consume context via the exported hooks (e.g. `useAuth`, `useModalContext`) rather than accessing providers directly.
- Contexts should remain orchestration layers; heavy domain logic should live in services or hooks.
- New contexts should clearly document their value shape and any invariants (for example, when fields may be `null` vs. guaranteed).
*** End Patch
