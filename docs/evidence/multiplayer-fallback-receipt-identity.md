# Fallback receipt identity

A real Firestore emulator reproduction first creates a valid empty-pool fallback, then changes its stored requestId while retaining the physical receipt key. Before the fix, discovery returned the fallback again despite its now-invalid physical identity; start acceptance already rejected that receipt, leaving discovery advertising an unusable opponent.

Fallback discovery now checks requestDocumentId(stored.userId, stored.requestId) against the actual document key before preference, acceptance and expiry replay checks. A mismatch reports data-loss without rewriting the receipt or creating a run. Two shape-valid corrupted identifiers cover a foreign request and an eight-character whitespace request. The original one-character whitespace case already failed shape validation and was replaced with a shape-valid case to test physical identity specifically.

The full fallback emulator suite verifies healthy repeated discovery, concurrent acceptance of one run, readiness/resume, player win, unattended loss, unauthorized/expired acceptance, human preference and corrupt-projection rejection. No client text or translations change.

The completion task runs full backend coverage, core/client regressions, seven isolated target builds, dependency/security checks and existing desktop/mobile discovery UI compatibility checks. Emulator transactions establish server receipt behavior; browser checks do not substitute for that evidence. The broader cross-kind matchmaking retry audit remains open. Jest activation remains authorized, publication/review stay held, and Firebase Functions deployment is authorized; this verification performs no external deployment.
