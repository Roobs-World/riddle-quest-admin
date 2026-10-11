# Current backend integration verification — 2026-10-09

All 1,303 current backend SDK integration tests passed across 91 suites, with no skipped tests, in 637.704 seconds. This closes the full-suite evidence gap after the stream ticket-retention and heartbeat-expiry fixes; those fixes had previously passed focused integration checks.

The run used the repository's pinned Node 22.23.1 runtime and isolated local Firestore, Realtime Database and Storage emulators under a demo project. The test selection was every `**/__tests__/**/*.it.test.ts` file. It covered multiplayer commands, exact receipt creation/lookup, stream lifecycle and expiry, account deletion, target gateways, referral/economy authority, and single-player persistence and locale behavior. This is local integration evidence, not deployed availability or player latency evidence.

Evidence is retained in `artifacts/current-stream-full-sdk-2026-10-09`:

- `integration-results.json`, `sdk.log` and `summary.json` retain the complete results.
- `compile.log`, `compiled/` and `compiled-sha256.json` retain 398 compiled files from current source.
- `source-before.json`, `source-terminal.json` and `source-verified.json` agree on all 2,525 selected source inputs. Source remained frozen throughout the run.
- `ports-closed.json` confirms all six owned emulator ports closed in the host network namespace. `cleanup.json` confirms the successful wrapper removed its temporary emulator directory and the archived compilation's owned `/tmp` output was removed.

Executable source is unchanged from the preceding [save-ordering build cohort](standalone-save-ordering-audit-2026-10-09.md), which built all six isolated client artifacts plus Devvit. This run does not add a UI change or repeat browser/build claims. No deployment, push, commit or publication occurred. The broader reliability, performance, playability and latency goal remains active.
