# ADR 0001: Single Source of Truth for Modal Definitions

- Date: 2026-04-10
- Status: Accepted

## Context

Riddle Quest currently has two modal mapping paths:

- Runtime rendering in `src/components/modals/ModalProvider.tsx`
- Registry/wrapper mapping in `src/components/modals/ModalRegistry.tsx`

This duplicates prop mapping logic and increases drift risk when modal props evolve.

## Decision

Use one canonical modal definition map (registry) as the source of truth for modal-to-props mapping.

- Runtime modal rendering will resolve modal components via `getModalComponent`.
- Development modal tooling will also use the same registry.
- New modal types must be added to the shared registry only.

## Consequences

### Positive

- Removes duplicated prop shaping logic.
- Reduces regression risk when modal APIs change.
- Improves discoverability of supported modal types.

### Trade-offs

- Registry shape becomes a critical dependency for runtime and dev tools.
- Requires robust contract tests around registry entries.

## Follow-up

- Add registry contract tests validating required modal types and basic rendering.
- Remove any dead branches that bypass registry mapping.
