# Optional matchmaking resolver failure isolation

An optional capability resolver could throw during tick processing or asynchronous discovery completion. Direct calls escaped the discovery lifetime checks, rejecting the public search promise or throwing from the browser interval instead of retiring the unavailable provider.

Capability resolution now catches optional lookup exceptions and returns unavailable. One shared ownership rule preserves legacy direct adapters when no resolver exists and requires exact current adapter identity when a resolver is configured. Search entry, tick retirement, saved-search recovery and fallback rematch use this lookup boundary. Existing account-generation checks still protect resolver reentrancy.

Three public-session regression cases failed before the fix; the valid provider control passed. All four cases now pass, as do eight injected desktop/mobile rendered cases for initial, tick and completion lookup failures plus valid lookup. The full current client suite passes 1,791 tests across 215 suites, with 103 tests across 14 suites skipped. Retained retry-policy and cancellation browser checks passed before extracting the shared ownership predicate.

The session briefly exceeded its maintainable size limit by one equivalent line. Extracting duplicated provider ownership conditions into the discovery helper restored the limit without formatting tricks or changing the configured ceiling. Documentation and types are required alongside all seven isolated builds and dependency audits.

The guarded manifest `docs/common/development/development-tasks/race-resolver-failure.json` retains 85 preceding checks and adds the new browser gate. A dashboard completion receipt requires all 86 checks and unchanged source digest and HEAD. This checkpoint does not claim the ongoing multiplayer audit or hosted E2E is complete.

Jest remains unpublished. No Firebase Functions deployment or game publication is performed.
