# Concurrent receipt acceptance diagnosis

Four injected production journeys (Chromium 153 and Firefox 153, at 390 and 1280 pixels) reproduced the same bug with 44 diagnostic assertions: original wrong guess accepted, independent full word checkpointed, reload snapshot at one guess, receipt response held, second instance accepts that full word, historical receipt released, fresh poll at two guesses. The client retained and persisted the consumed word at the newer count. There was no automatic replay, browser error or unhandled rejection.

The fixture models immutable backend receipts; the existing actual Firestore lookup test also accepted a historical receipt after a later guess. This is a different interleaving from the previously fixed case where the original guess was never accepted. Previous browser evidence must not be interpreted as covering this newly discovered race.

Five observed source hashes match the pre-run full SDK freeze. These observations demonstrate the bug, not successful fixed behavior. Artifacts: `artifacts/live-receipt-concurrent-acceptance-audit-2026-10-09/`.
