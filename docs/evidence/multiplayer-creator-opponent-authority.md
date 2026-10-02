# Creator opponent authority

A creator run records its own target. Opponents belong to challenger attempts. Startup selection already enforced this distinction, but subsequent readiness, cold resume and later recovery could accept a schema-valid creator response containing an opponent. That could change deadline and result behavior.

The authority snapshot validator now rejects this contradiction before adopting state or consuming a checkpoint. The validation uses the response role, and existing private ownership checks continue to reject role rewrites. Legacy challenger responses may still omit opponent details and receive them later; opponent identity anonymization remains allowed.

Three new regression cases failed before the fix. All five focused cases pass after the fix, covering readiness and clean retry, public-view mutation and recovery, cold valid/invalid creator resume, and legacy challenger enrichment. The full client suite passes with 1,761 tests across 210 suites (102 tests across 13 suites skipped). Eight injected desktop/mobile browser scenarios pass through the actual rendered bridge surface.

The guarded manifest `docs/development-tasks/race-creator-opponent-authority.json` retains the previous 80 required checks and adds the new browser gate. Its completion receipt records exact source stability, successful checks and isolated artifact hashes; no receipt is produced if any required check fails.

The audit remains ongoing. This is a development checkpoint, not hosted full-pathway E2E completion. Jest stays unpublished; no Firebase deployment is performed.
