# Multiplayer attempt budget authority

The shared race projection schema now checks that editable questions retain their fixed guess budget, have at least one guess remaining, and expose hint availability consistent with the exact remaining per-run hint capacity. Legacy one-hint runs retain their recorded smaller limit. The server already projects remaining guesses as maximum minus used guesses and advances or ends a run on the fifth incorrect guess; hints already use the minimum of the recorded hint limit and answer length.

Before the fix seven individually valid but contradictory attempt or hint states were accepted. All seven negative cases now pass along with seven valid editable or exhausted-hint cases. Full core verification passes 207 tests across 23 suites. Full client race verification passes 468 tests across 35 suites, including four new start and resume cases proving invalid run hints are not saved and typed input survives rejection and later valid recovery.

The real React injected browser harness checks contradictory guess count, exhausted editable guesses, premature hint unavailability and exhausted hints advertised as available in desktop and mobile viewports. All eight cases reject the invalid start and recover through a valid retry without readiness or browser errors. The mobile recovered screen was visually inspected. Shared core distribution was rebuilt before browser execution.

The development manifest requires the full fifteen verification gates, including backend emulator coverage, all client and core tests, types, lint, architecture safeguards, browser checks and seven isolated platform artifacts. Source and artifact hashes are verified before recording dashboard completion.

No visible text or locale content changes were introduced. This task does not upload, activate or publish Jest or deploy Firebase Functions. Jest activation and Firebase Functions deployment are authorized; game publication, review submission and listing visibility remain held. The ongoing multiplayer reliability audit remains active.
