# Fallback category contract

The real Firestore emulator reproduced a failure: an explicit history search created a canonical fallback, then a shape-valid persisted category change to science caused retry to advertise science under the original history request. The original receipt schema validated both categories independently but did not constrain their relationship.

The shared fallback receipt schema now requires selected category to equal requestedCategoryId whenever the search explicitly specifies a category. A null requestedCategoryId still permits server selection from any available category. Both discovery replay and start acceptance use this schema, so contradiction becomes data-loss before gameplay or economy writes.

The emulator regression checks discovery and acceptance rejection, no run creation and no rewriting of the corrupted receipt. A focused parser case independently checks contradictory explicit preferences and valid unrestricted selection. The full fallback unit/emulator suites passed 24 tests, retaining playback, full gameplay, identity, cross-kind receipt ownership and expiry checks. The pre-fix emulator failure was observed at discovery; its later acceptance assertion had not yet executed, so pre-fix acceptance success is not claimed.

The clock audit found no unsafe-integer gap: the installed Zod integer schema already rejects Number.MAX_SAFE_INTEGER + 1. No clock production change was needed.

No UI copy or locales change. The completion task runs full backend coverage, core/client regressions, seven isolated targets, dependency/security checks and existing desktop/mobile discovery compatibility harnesses. Server receipt behavior is evidenced by the emulator, not inferred from UI rendering. Jest activation is authorized; publication/review remain held. Firebase Functions deployment is authorized, but this verification performs no deployment. The ongoing reliability audit remains active.
