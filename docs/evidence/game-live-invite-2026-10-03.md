# Direct multiplayer invitation recovery — 3 October 2026

This pass continues the game reliability, performance, playability, and latency goal. Direct invitations previously awaited an authenticated transport indefinitely, allowed a different recipient after an unknown delivery failure, and accepted old queue acknowledgments after the displayed lobby or transport changed.

## Reproduction and change

The actual React StrictMode `LiveRaceDirectInvite` component was exercised with controlled authority promises in the actual race stylesheet context. The preserved baseline (`5e721d5c2c4924ab654bb2bacab1c52247a3369570809392275201d5a8e772b1`) produced 14 mismatches among 26 desktop/phone observations. A never-settling request kept the controls busy beyond the existing live-command budget; changed ownership retained old queue success; ambiguous and malformed replies allowed unsafe recipient correction.

Direct delivery now uses the existing 10-second `liveRaceDeliveryDeadline`. Timeout releases local busy controls and exposes translated Retry without claiming that server delivery was rejected or cancelled. The original lobby and trimmed recipient remain frozen for exact replay. Initial explicit invalid-argument/not-found refusals allow correcting the name. A later refusal cannot erase an earlier unknown queue outcome: an additional browser regression reproduced this edge before the final fix.

Only a strict validated queue receipt confirms success and synchronously closes further admission. Matching older receipts can recover a settled failed retry, but cannot settle a pending retry or another recipient selection. Lobby/transport replacement gives the panel a fresh lifetime; retirement aborts its local wait and suppresses old presentation updates while retaining observation of the SDK promise. Ordinary profile renders preserve the original delivery. All visible copy reuses existing translated keys.

The existing full invitation harness exposed an unrelated touch-target regression: the lobby stylesheet overrode the shared notification control's 48-pixel minimum with 44 pixels. The override now preserves 48 pixels. The harness also accepts `LIVE_RACE_REPORT_DIR`, so this pass writes its evidence to an isolated output directory.

The authority already binds one recipient per lobby and idempotently replays its durable inbox/outbox receipt. No backend invitation implementation, provider SDK, economy rule, or target boundary was changed.

## Verification

Evidence is stored under `artifacts/game-live-invite-2026-10-03/`:

- Final direct-invitation browser harness: all 34 observations passed at 1280 and 390 pixels. Additional assertions cover duplicate admission, exact original-recipient retries, exclusion of late receipts during pending replay, explicit name correction, late recovery after a failed replay, malformed data, ownership replacement, unmount, and profile rerender. No uncaught browser errors occurred. Saved input/button geometry fits both widths and exceeds 44 pixels; screenshots were inspected. The verifier is included in the normal game-browser command.
- Existing full invitation browser harness: passed all native and direct journeys for Jest, Facebook invite, and Facebook share at both widths. It exercises native dismissal/failure retry, one durable inbox notification after reload, notification-permission fallback/revocation, explicit acceptance into the original lobby, countdown, and shared gameplay. Notification buttons meet the existing 48-pixel check. Unsupported native hosts omit the native invitation action.
- Real backend authority ran in an isolated Firestore emulator under `demo-game-live-invite-goal`, after a successful backend build. Emulator execution exited zero and shut down. Native SDK dialogs and push permission are injected fixtures; no production player was contacted.
- Full portal suite: 275 suites and 2,364 tests passed; 118 opt-in browser tests skipped. All workspace type checks passed.
- All six production target builds and artifact-isolation audits passed after the stylesheet change. `build-results.json` records every exit code; `runtime-source-hashes.json` matches the final component and stylesheet.
- Final TSDoc audit passed for 23,843 declarations across 1,090 files. File-size audit passed for 1,164 source files. Script syntax and scoped whitespace checks passed.

Browser checks used Chromium. Firefox MCP was not exposed among this session's callable tools, so Firefox verification is not claimed. The shared checkout includes concurrent work from other chats; aggregate checks describe the combined tested state. No deployment or commit was performed.

The goal remains active. Next, examine native invitation dialog ownership in `LiveRaceInviteShare`: its callback currently shares busy/error state across lobby or provider replacement. Preserve native dialog exclusion while reproducing late settlement; a dialog timeout must not enable overlapping native dialogs.
