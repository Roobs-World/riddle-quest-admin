## Services Overview

The `services` folder contains framework-agnostic modules that encapsulate data access, backend integration, and cross-cutting domain behavior.

Typical examples include:

- **Firebase-facing services**: `FirestoreService`, `RiddleService`, `UserDataService`, `AuthService`, `IapService` — wrap the Firebase SDK and Cloud Functions with typed, higher-level operations.
- **Game orchestration helpers**: `GameStateManager`, `RiddleInitializationService`, `RiddleDataService` — coordinate game-flow–specific logic while keeping React components thin.
- **Visual and audio services**: `SoundManager`, `AudioFeedbackManager`, `SolarSystemPreloader`, `TextureDebugger` — manage sound playback, haptics, and 3D assets.

### Usage Conventions

- Services SHOULD avoid importing React and remain usable from both components and tests.
- Prefer passing dependencies in (or using the existing `serviceRegistry`) rather than hard-coding global state where possible.
- When adding a new service, document its exported API with TSDoc and add a short bullet here explaining its responsibility.
