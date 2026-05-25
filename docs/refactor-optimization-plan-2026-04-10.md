# Refactor and Optimization Plan (2026-04-10)

## Progress (updated 2026-04-10)

- [x] Phase 0.1 Align alias config between TS and Babel direction (`@/*` -> `src/*`).
- [x] Phase 0.2 Add architecture decision record for modal single-source-of-truth.
- [x] Phase 0.3 Mark legacy `GameStateManager` as deprecated.
- [x] Phase 1.1 Introduce `useGameSessionController` with shared server-loading orchestration.
- [x] Phase 1.2 Introduce `gameModalActions` helpers and wire `GameScreen` to shared modal actions.
- [x] Phase 2.1 Extract auth bootstrap helpers into `src/features/auth/sessionBootstrap.ts`.
- [x] Phase 2.2 Add segmented contexts and hooks (`useAuthSession`, `usePlayer`, `useRiddleState`) while preserving `useAuth` compatibility.
- [x] Phase 3.1 Consolidate runtime modal rendering to use `ModalRegistry` as source of truth.
- [x] Phase 3.2 Add missing `gameMode` modal registry entry to close parity gap.
- [x] Phase 3.3 Split solar system static config into `src/services/solar/solarSystemConfig.ts` and wire preloader to it.
- [x] Phase 1.3 Add controller boundary tests.
- [x] Phase 2.3 Add auth bootstrap scenario tests.
- [x] Phase 3.4 Add modal registry contract tests.
- [x] Phase 3.5 Split remaining solar preloader concerns (texture loader/factory/cache modules).
- [x] Phase 4.1 Move locale overrides out of monolithic `AppStrings.ts`.
- [x] Phase 4.2 Add lazy language loading path.
- [x] Phase 4.3 Add localization parity + startup smoke tests for the new i18n loading path.

### Validation run

- `pnpm exec jest src/features/game-session/__tests__/useGameSessionController.test.ts src/features/auth/__tests__/sessionBootstrap.test.ts src/components/modals/__tests__/ModalRegistry.test.ts src/contexts/__tests__/AuthContext.test.tsx --runInBand`
  - Result: pass (4 suites / 17 tests).
  - Note: existing console noise in `AuthContext` tests from `NotificationService` mocked Firestore shape mismatch.
- `pnpm exec jest src/constants/__tests__/AppStrings.i18n.test.ts src/constants/__tests__/AppStrings.test.ts src/features/game-session/__tests__/useGameSessionController.test.ts src/features/auth/__tests__/sessionBootstrap.test.ts src/components/modals/__tests__/ModalRegistry.test.ts src/contexts/__tests__/AuthContext.test.tsx --runInBand`
  - Result: pass (6 suites / 95 tests).
  - Note: same pre-existing console noise in `AuthContext` tests from `NotificationService` mock mismatch.
- `pnpm exec jest src/features/game-session/__tests__/gameModalActions.test.ts src/features/game-session/__tests__/useGameSessionController.test.ts src/services/solar/__tests__/solarSystemConfig.test.ts src/services/solar/__tests__/textureCache.test.ts src/services/solar/__tests__/textureLoader.test.ts src/services/solar/__tests__/sceneFactory.test.ts src/i18n/__tests__/languageOverrides.test.ts --runInBand`
  - Result: pass (7 suites / 19 tests).
  - Purpose: verify new-file unit-test coverage after TSDoc/test hardening pass.

## Scope and approach

This plan is based on a codebase scan focused on architecture depth, coupling seams, and optimization opportunities with low migration risk.

## Key opportunities

### 1) Decompose `GameScreen` into a deep gameplay orchestration module

- Evidence:
  - `src/screens/game/GameScreen.tsx` is ~1,029 lines and currently coordinates gameplay, ads, IAP, settings persistence, modal orchestration, and server-loading state.
  - The file has a high concentration of hook/state orchestration and callback churn (`runWithServerLoading` is used across many independent concerns).
- Why this matters:
  - High change surface area increases regression risk and slows feature work.
  - UI rendering and game-flow orchestration are tightly coupled.
- Proposed refactor:
  - Create `src/features/game-session/useGameSessionController.ts` that owns non-visual orchestration:
    - submit/continue/next-level flows
    - hint/skip/pay-and-play decision logic
    - loading counters for server calls
    - rewarded ad + IAP interaction flow
  - Keep `GameScreen.tsx` mostly declarative (render + prop wiring).
  - Split modal action creators into `src/features/game-session/gameModalActions.ts`.
- Optimization impact:
  - Lower re-render churn from stable, narrower hook boundaries.
  - Easier memoization of child props.
- Test impact:
  - Add boundary tests for `useGameSessionController` (submit win/loss, attempt-limit path, ad-not-ready path, coin-shop actions).
  - Reduce large UI integration tests in `GameScreen` in favor of controller tests.

### 2) Extract Auth bootstrap flow out of `AuthContext`

- Evidence:
  - `src/contexts/AuthContext.tsx` combines auth-state subscription, user bootstrap, riddle initialization/polling, notification token registration, analytics, and profile hydration.
  - File includes comments about split context values, but still exposes one merged context object, so most consumers still re-render on broad state changes.
- Why this matters:
  - Session bootstrap complexity is concentrated in one provider, increasing lifecycle bugs.
  - Authentication and gameplay bootstrapping are mixed concerns.
- Proposed refactor:
  - Extract bootstrap state machine into `src/features/auth/sessionBootstrap.ts` (or `AuthBootstrapService.ts`).
  - Introduce real segmented context exports:
    - `AuthSessionContext`
    - `PlayerContext`
    - `RiddleContext`
  - Keep `useAuth()` as compatibility wrapper, but migrate high-churn callers to narrow hooks (`usePlayer`, `useRiddleState`).
- Optimization impact:
  - Fewer unnecessary renders for screens that only need one slice.
  - Clearer ownership for auth listeners and cleanup.
- Test impact:
  - Add focused tests for bootstrap transitions (anonymous user, new social user without email, returning user, failure paths).

### 3) Consolidate modal architecture to one source of truth

- Evidence:
  - There are two parallel modal mapping systems:
    - `src/components/modals/ModalProvider.tsx` (switch-based renderer)
    - `src/components/modals/ModalRegistry.tsx` (registry wrappers)
  - `ModalRegistry` is primarily consumed by development tooling (`ModalTogglePanel`) rather than production rendering flow.
- Why this matters:
  - Duplicate mapping logic increases drift risk when modal props change.
- Proposed refactor:
  - Use a single modal definition map (`modalDefinitions.ts`) shared by runtime renderer and dev tooling.
  - Keep one render path in production (`ModalProvider`) and adapt dev panel to consume the same definitions.
  - Remove duplicated prop-shaping branches.
- Optimization impact:
  - Fewer maintenance bugs and lower code size from deleted duplicate wrappers.
- Test impact:
  - Add a contract test ensuring each modal type resolves and receives required props.

### 4) Split `SolarSystemPreloader` into loader + builder + cache layers

- Evidence:
  - `src/services/SolarSystemPreloader.ts` is very large (~41KB) and mixes:
    - static config data
    - asset loading
    - geometry/material creation
    - scene assembly and caching
- Why this matters:
  - Monolithic 3D setup is hard to profile and reason about.
  - Memory/resource management changes are risky in a single file.
- Proposed refactor:
  - `solar/config.ts`: planet/moon/ring manifests
  - `solar/textureLoader.ts`: asset download + texture creation
  - `solar/sceneFactory.ts`: geometry/material/mesh creation
  - `solar/cache.ts`: lifecycle + disposal strategy
- Optimization impact:
  - Enables targeted perf profiling (texture IO vs scene build cost).
  - Easier to add lazy/non-blocking warmup by stage.
- Test impact:
  - Unit tests for config integrity and texture key mapping.
  - Smoke test for factory output shape (scene, camera, mesh count).

### 5) Normalize path aliasing and tighten TypeScript boundaries

- Evidence:
  - `tsconfig.json` maps `@/*` to `assets/*`, while `babel.config.js` maps `@` to `./src`.
- Why this matters:
  - Tooling mismatch causes editor/build confusion and fragile imports.
- Proposed refactor:
  - Align TS + Babel alias contracts (prefer `@/* -> src/*` and explicit asset aliases).
  - Remove ambiguous alias behavior.
  - Add stricter incremental checks in non-test code (start with `noUncheckedIndexedAccess` in trial mode).
- Optimization impact:
  - Faster developer iteration and fewer path-resolution errors.
- Test impact:
  - Run typecheck and import-resolution smoke checks in CI.

### 6) Modularize large string catalog and add lazy language loading

- Evidence:
  - `src/constants/AppStrings.ts` is very large and includes multiple locales in one module.
- Why this matters:
  - Increases startup parse/load work and concentrates localization churn.
- Proposed refactor:
  - Move to `src/i18n/{en,es,pt,...}.ts` with a typed `getStrings(language)` loader.
  - Keep current key schema via shared TS type generated from `en` base.
- Optimization impact:
  - Reduced initial JS work when loading one language at runtime.
- Test impact:
  - Keep key-parity tests across locales; add language fallback tests.

### 7) Remove or quarantine dead/legacy game-state abstractions

- Evidence:
  - `useGameStateManager` has no production call sites and `GameStateManager` appears legacy relative to `useGameLogic`.
- Why this matters:
  - Dead pathways increase cognitive load and test burden.
- Proposed refactor:
  - Mark as deprecated immediately; remove after one release cycle if no migration blockers.
  - Retain only if needed for planned alternate gameplay mode.
- Optimization impact:
  - Smaller surface area and less duplicate business logic.
- Test impact:
  - Delete associated legacy tests if module is removed.

## Prioritized execution plan

### Phase 0 (Quick wins, 1-2 days)

1. Align alias config between TS and Babel.
2. Add architecture decision note for modal single-source-of-truth direction.
3. Identify and flag dead modules (`GameStateManager`) with deprecation comments.

### Phase 1 (Low risk, high leverage, 3-5 days)

1. Extract `useGameSessionController` from `GameScreen` without behavior changes.
2. Move game modal action builders into dedicated module.
3. Add controller boundary tests and keep existing screen tests green.

### Phase 2 (Medium risk, highest architectural payoff, 4-7 days)

1. Extract auth bootstrap flow from `AuthContext` into dedicated service/state machine.
2. Introduce real segmented contexts and migrate highest-traffic consumers first.
3. Add auth bootstrap scenario tests (social/new/guest/retry/failure).

### Phase 3 (Medium risk, cleanup and performance, 3-5 days)

1. Consolidate modal definitions and remove duplicate mapping logic.
2. Split `SolarSystemPreloader` into focused modules with unchanged public API.
3. Add simple perf instrumentation around preload phases.

### Phase 4 (Optional optimization, 3-4 days)

1. Move monolithic `AppStrings` to modular `i18n` files.
2. Add lazy loading and fallback behavior.
3. Run localization parity tests and startup smoke checks.

## Success criteria

- `GameScreen.tsx` reduced from ~1,000 lines to <= 350 lines.
- `AuthContext.tsx` reduced by moving bootstrap logic and splitting consumer subscriptions.
- Single modal definition path used by runtime and dev tooling.
- No behavior regressions in auth flow, gameplay completion, modal rendering, rewarded ads, or IAP purchase flow.
- Startup and navigation remain stable; no increase in crash/error rate after rollout.

## Rollout and risk management

1. Ship in small PRs per phase, each with no behavior change unless explicitly scoped.
2. Add feature flags for high-risk refactors (auth bootstrap split, i18n loader) if needed.
3. Keep old wrappers temporarily (`useAuth` compatibility) and migrate callers incrementally.
4. Track runtime telemetry for auth errors, modal render errors, rewarded ad failures, and game completion events after each phase.
