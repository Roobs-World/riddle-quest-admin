# ADR 0002: Pattern Catalog and Documentation Contract

- Date: 2026-05-29
- Status: Accepted

## Context

The codebase already uses a layered architecture with several explicit patterns:

- Repository and Adapter boundaries for persistence
- Facades for auth and modal orchestration
- Command objects for modal dispatch
- Chain of Responsibility for modal fanfare sequencing
- Strategy-like selection for riddle loading and auth policies
- Singleton services for cross-cutting infrastructure such as analytics and event buses

Those patterns are helpful only when they are discoverable. Without a canonical catalog, the repo drifts into a situation where the code is pattern-shaped but the rationale lives only in branch history or in one-off comments.

## Decision

Use a single documentation contract for pattern-heavy modules:

1. Every exported pattern-bearing API in `src/` and `firebase-functions/src/` should have TSDoc.
2. High-complexity orchestration modules should include `@fileoverview` blocks.
3. Cross-cutting patterns should be recorded in `docs/memory-bank/systemPatterns.md`.
4. Non-trivial ownership changes should be recorded in ADRs under `docs/adr/`.
5. Documentation should name the pattern, the boundary, the invariants, and the failure mode.

## Consequences

### Positive

- New contributors can find the architectural intent without reading the whole repo.
- Refactors can be validated against a local contract instead of guessing at conventions.
- Pattern boundaries become easier to test and easier for agents to preserve.

### Trade-offs

- Documentation must be maintained when patterns change.
- Some modules now carry more prose than they did before, which is intentional and only acceptable when the module is actually doing orchestration work.

## Canonical pattern map

- `src/application/auth/AuthSessionFacade.ts` - auth-session facade for daily-completion, streak, and session snapshot policies.
- `src/application/auth/PlayerRepository.ts` - repository for player persistence across Firestore and guest local storage.
- `src/application/auth/RiddleSessionService.ts` - strategy-like riddle loader and polling orchestrator.
- `src/application/auth/useAuthProviderController.ts` - auth bootstrap controller and React boundary.
- `src/application/modals/ModalCommandBus.ts` - modal command dispatch and typed modal factories.
- `src/application/modals/ModalFanfareSequence.ts` - fanfare sequencing and continuation handling.
- `src/services/AnalyticsService.ts` - analytics singleton and event-bus subscriber.
- `src/services/GameEventBus.ts` - singleton event bus for game telemetry.
- `src/screens/game/GameScreen.tsx` - container that should remain thin and delegate orchestration outward.

## Follow-up

- Keep this catalog synchronized with future application-layer modules.
- Prefer adding a pattern entry here rather than scattering new architecture notes across branch-specific docs.
