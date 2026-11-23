# Native multiplayer invitation ownership — 3 October 2026

This pass continues the game reliability, performance, playability, and latency goal. A native invitation dialog previously wrote its result into the currently rendered lobby even when the lobby, multiplayer transport, or native callback had changed. Failure notices also survived those replacements. Malformed provider outcomes silently bypassed the retry notice.

## Reproduction and change

An injected browser harness mounts the actual React StrictMode `LiveRaceInviteShare` with controlled native provider promises, its referral capability context, and the actual race stylesheet. The preserved component baseline SHA-256 is `31fc148c5d3f422cf950c729d4c8a29c1081aba3d7a7d0ac7e21b51f70eee78d`. It produced 30 mismatches among 66 observations across desktop and phone widths; the baseline exits nonzero as expected.

Each lobby/transport/callback visit now owns its failure feedback. A click captures that owner before invoking the selected native callback synchronously. Only that owner and its still-mounted effect lifetime can publish a failure. Replacement immediately hides old notices, and old returned errors or thrown rejections cannot enter the replacement panel. StrictMode replay receives a fresh presentation lifetime; unmount retires the original one. Ordinary rerenders with unchanged ownership preserve the dialog and any current retry notice.

The synchronous native-dialog exclusion guard survives lobby/provider replacement. It stays held until the original provider promise settles, including when the capability temporarily disappears. Elapsed time alone cannot prove that native UI has closed, so no transport deadline releases this gate or enables overlapping provider dialogs. When the old dialog actually settles, the still-mounted panel becomes available for a fresh invitation through its current provider and current lobby. This retains the provider's own dialog gate and preserves synchronous gesture dispatch.

Expected success and cancellation leave no error; current provider errors, thrown rejections, and malformed outcomes expose the existing translated retry/error flow. A provider dialog outcome never counts as recipient acceptance. No SDK implementation, purchase/referral authority, backend mutation, target boundary, or visible translation key changed.

## Verification

Evidence is under `artifacts/game-native-invite-2026-10-03/`:

- Actual native invitation harness: all 66 observations passed at 1280 and 390 pixels. Checks cover immediate duplicate exclusion, unresolved dialogs after 60 seconds, cancellation, current error/retry, successful retry, lobby/transport/callback replacement, fallback selection, hidden/restored capabilities, profile rerenders, malformed outcomes, and settlement after unmount. Additional input assertions prove that fresh invitations select the new lobby and correct provider generation. No uncaught browser errors occurred. Saved geometry fits both widths and retains at least 48-pixel controls; screenshots were inspected.
- Existing complete invitation harness: passed native and direct invitation journeys for Jest, Facebook invite, and Facebook share at both widths, including native dismissal/failure retry, durable inbox reload, push permission fallback/revocation, explicit acceptance into the original lobby, countdown, shared gameplay, and unsupported-native-host omission. The server ran against the dedicated `demo-game-live-invite-goal` Firestore emulator. The process exited zero and shut down its emulator. Native dialogs and push permission are injected fixtures; production players were not contacted.
- Full portal suite: 275 suites and 2,364 tests passed; 118 opt-in browser tests skipped. All workspace type checks passed.
- All six production target builds and artifact-isolation audits passed. `build-results.json` records exact exits and durations. `runtime-source-hashes.json` and the final source check match the tested component.
- TSDoc audit passed for 23,852 declarations across 1,090 files. File-size audit passed for 1,164 source files. Script syntax and scoped whitespace checks passed. The new harness is registered in the normal game-browser command.

Browser verification used Chromium. Aggregate checks describe the combined shared-checkout state, including concurrent work from other chats. No commit or deployment was performed. No production latency improvement is inferred from these local fixtures.

The goal remains active. Next, reproduce `LiveRaceInbox` presentation across transport replacement: its effect rejects late responses but retains the previous transport's already-rendered challenge rows until another read completes. Verify that a replacement account never displays or accepts those old invitation cards, including when its new inbox read stalls or fails.
