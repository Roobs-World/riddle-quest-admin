# Multiplayer web dialog ownership

30 September 2026; working-source changes based on `c34be571`.

Optional browser dialogs now capture Race Session journey ownership through
`captureJourney`. Navigation away and back to the same screen, discovery,
rematch, entry replacement, disposal and authority screen/run changes invalidate
the captured visit. Harmless clock and input updates preserve it. Rendering
adapters no longer approximate ownership with only a screen name and run ID.
Native social calls also have a synchronous duplicate guard before React commits
disabled controls. Sharing retains its existing duplicate guard and now uses the
same journey check for late errors.

Accepted provider context selection clears old standings, cancels only an owned
context read and refreshes the visible Activity board. A hidden context cache is
cleared without cancelling a tournament read. Late old-context responses cannot
finish the replacement delivery, and changing context recovers an earlier board
error without replaying a race mutation.

Injected browser verification also exposed membership synchronized in English
before the restored French game preference took effect. The Facebook HTML5
context adapter now reconciles the current SDK context and game language before
board reads or recording. Concurrent consumers share one reconciliation; already
synchronized consumers issue no membership write. Delivery rechecks mutable
language/context, failing closed if either changed while membership was pending.
A subsequent explicit read can recover.

Public-interface regressions cover journey invalidation, ordinary ticks, authority
completion, context cache replacement, stale replies, unrelated tournament reads,
provider error recovery, coalesced membership reconciliation and language changes
during delivery. The actual injected Facebook HTML5 browser flow exercises
same-task clicks, leave/revisit/late failure, context replacement and restored
French preferences, together with the existing authentication/pause/reload flow.
Its inspected screenshot is `/tmp/race-context-dialog-recovery.png`.

The full Jest creator/publication/reusable recipient journey verifies sharing
against the changed web client. All isolated artifacts remain HTML5 builds; no
native app target, new provider SDK or visible translation key is introduced.

Stable-source verification and local dashboard recording use:

```sh
pnpm development:complete docs/development-tasks/race-web-dialog-ownership.json
```

This is partial evidence for the ongoing multiplayer reliability audit. The
repository-wide TSDoc audit now passes after documenting the remaining web
recovery test fixtures; file-size limits also pass. The sharing journey passed
when run sequentially, including its actual GO render and recipient flows.

The first full completion recorder passed its checks but withheld a receipt
because the shared source digest changed during verification. Completion requires
a stable-source receipt. Current build scope excludes standalone web/PWA releases;
the verification command builds only platform-specific HTML5 targets.
