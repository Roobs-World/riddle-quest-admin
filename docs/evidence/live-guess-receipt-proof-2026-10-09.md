# Private accepted-guess receipt proof — 9 October 2026

The live race transaction now records private evidence for an accepted wrong guess that leaves the same question active. The receipt stores ticket ID, riddle ID, position and the attempt counts before and after acceptance. It stores no answer or submitted word and adds nothing to the public response. Correct guesses, auto-skips, hints and skips do not receive this proof.

The proof is created atomically with the existing user-scoped, immutable command receipt. A retry preserves the original proof even after a later guess advances the count. A conflicting command using the same request ID is rejected. Legacy receipts remain unchanged and cannot acquire invented historical evidence.

This completes the first implementation stage of [ADR 0006](../adr/0006-live-guess-receipt-recovery.md). The authenticated read-only lookup, target adapters and client recovery are still pending; this change alone does not restore typing entered while a guess reply is delayed.

## Verification

- Pinned Node 22 compilation, backend lint, TSDoc and file-size checks pass.
- All 1,761 backend unit cases across 140 suites pass.
- Real Firestore SDK integration: 47 cases across the original live race suite and four new receipt-proof cases pass. This was a targeted integration run, not the entire backend SDK matrix.
- All six isolated client target builds and the Devvit server build pass their build checks.
- The 2,507 selected source inputs match before, terminal and final verification manifests. These manifests are not an exhaustive inventory of content/public files.
- Archived build output contains 1,299 files; both isolated compiler outputs are separately archived and hashed. Six target dependency inventories are retained.
- Owned build/compiler/emulator temporary roots were removed after completion. All six final emulator ports were checked closed from the host process namespace.

No UI, core DTO or adapter changed, so no new rendered-browser run is claimed. Hosted artifacts retain the previous output; protected self-contained packs and their referencing chunks differ between builds. The content protection implementation generates a fresh random 96-bit AES-GCM IV on every encryption (`packages/core/src/contentProtection.ts`). Raw encrypted bytes therefore do not establish a content change or a performance improvement.

Evidence: `artifacts/live-guess-receipt-proof-2026-10-09/`; run `python3 artifacts/live-guess-receipt-proof-2026-10-09/verify.py` to verify archived hashes, results and cleanup. Historical manifests record this cohort and should not be rewritten when subsequent implementation changes source.
