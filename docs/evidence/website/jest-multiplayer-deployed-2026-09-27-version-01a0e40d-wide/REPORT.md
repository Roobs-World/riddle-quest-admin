# Jest multiplayer verification and repair report — 2026-09-27

Status: **deployed two-player journey passed; exact opponent score mapping verified; discovered app feedback defects fixed and locally verified.**

## Deployment under test

- Candidate URL: `https://jest.com/g/riddle-q?versionId=01a0e40d-72b2-76b6-92af-8cb126fe840d&rl=4884f7`
- Jest version ID: `01a0e40d-72b2-76b6-92af-8cb126fe840d`
- Build: `1.0.0-dev.20260927174851.7216833e4333.d51ad980`
- Host viewport: 520 × 932
- Game iframe viewport: 424 × 692
- Browser: headless Chromium in the live Jest shell

Two separate registered Jest accounts were used. Credentials, raw login links,
player IDs, referral URLs, challenge IDs, and App Check values are not stored in
this directory.

## Deployed journey result

1. Player 1 entered Multiplayer, selected History, and completed a 10/10 run.
2. The server-authoritative adjusted finish was **34,632 ms** with no hint or
   skip penalties.
3. Player 1 published the completed run and opened the real Jest recipient flow.
4. Player 2 followed the returned Jest referral in a separate authenticated
   browser context and received Player 1's invite.
5. Player 2 accepted and played until Player 1's recorded ghost reached 10/10.
6. The race ended correctly at Player 2 8/10 versus Player 1 10/10, displaying
   **Opponent wins**.

The apparent early end at Player 2 8/10 is correct race behavior: the opponent's
recorded score finished first, so the challenge was complete.

## Opponent-score integrity

The test did not rely only on rounded UI text. It asserted all of the following:

- Player 2 received the same opaque challenge ID that Player 1 published.
- The received creator name matched the opponent rail.
- The opponent recording contained Player 1's ten correct score events.
- Player 1's completed run and Player 2's opponent recording both carried the
  exact adjusted finish time **34,632 ms**.
- The visible invite rounded that exact score to **0:34.6**.
- The terminal UI outcome agreed with the replay: **Opponent wins**.

Machine-readable assertions are in [RESULT.json](./RESULT.json).

## Findings and fixes

### Fixed — publishing could appear blocked behind background outcome confirmation

When `raceOutcome` reconciliation was still in flight, **Send challenge** was
disabled by the shared pending-operation slot. A player who had already seen
their completed result could not express the next action immediately.

The client now records publish intent at once, marks only the publish control
busy, and automatically performs the idempotent authoritative publish as soon
as the current reconciliation finishes. The server remains the authority for
the challenge ID, immutable score, and rewards.

A browser regression first reproduced the failure as a one-second click timeout
on a disabled button. It now verifies that the click is accepted before the
delayed outcome response, the button immediately exposes `aria-busy`, and the
real publish follows in the background.

### Fixed — provider sharing had no immediate feedback or duplicate-call guard

While Jest's recipient picker was opening, **Challenge a friend** remained
apparently idle and clickable. The control now becomes busy and disabled
immediately, displays a compact spinner, and a synchronous guard prevents a
second provider share dialog.

The browser regression delays the provider callback for two seconds and proves
the busy state appears immediately and clears after completion.

### Improved — background race operations now remain visible

The existing thin operation indicator now covers in-flight hint, skip, outcome,
and publish work during the race and result stages, instead of only guess
submission. This makes delayed server work visible without blocking the
already-projected local result.

### Fixed — closing during a delayed start could orphan the authoritative run

The countdown close control previously dismissed Multiplayer while `raceStart`
was still in flight. If the server created the run after the component unmounted,
the client never received or persisted its run ID and could not abandon it.

Close is now recorded immediately as cancellation intent. The countdown changes
to **Quitting…**, the close control exposes `aria-busy`, and the component remains
the response owner just long enough to receive the run ID, send the idempotent
authoritative abandon, and exit. A browser regression holds `raceStart` for two
seconds, closes during the wait, proves immediate feedback, verifies cleanup,
and then starts another race successfully.

### Improved — every remaining multiplayer mutation identifies its busy action

Native matchmaking/context selection, block, report, and quit confirmation now
mark the initiating control busy while disabling conflicting actions. Block and
report feedback is target- and operation-specific, so another row does not look
like the action that is running. Browser coverage holds both safety responses
and verifies feedback before releasing the server result.

Delayed opponent-outcome coverage also verifies that category navigation remains
ahead of stale reconciliation work and is not replaced by the old result.

### Corrected finding — earlier clipping was a test viewport artifact

The earlier 390-pixel host capture was narrower than Jest's own approximately
509-pixel preview iframe, placing the iframe at a negative host-shell offset.
The game document itself was 424 pixels wide with no internal horizontal scroll.

This controlled run used a 520-pixel host viewport. The entire 424-pixel game
iframe is visible, and lobby, invite, and result layouts are not horizontally
clipped. The app also now explicitly suppresses horizontal race-screen overflow,
with a 390-pixel browser containment regression. There is no remaining evidence
of an app layout defect.

### Preview-only behavior — inactive candidate navigation must stabilize

A referral naturally opens the active Jest release before this test reopens the
specified inactive candidate while preserving the signed-in session and entry
payload. Clicking Accept during that special iframe replacement can lose the
click. The live runner now waits for the candidate frame to remain stable before
interacting. This is a candidate-test handoff issue, not evidence of a failure
in normal active-release referrals.

### Non-blocking Jest host noise

The live shell logged a sandboxed Storage Access API refusal for each player.
Player 1 also observed one HTTP/2 failure and aborted server-event subscriptions
during navigation. There were no page exceptions. Identity, publication,
referral resolution, authoritative score replay, and completion all succeeded,
so these are recorded as Jest-host diagnostics rather than game failures.

## Verification

- Live Jest two-account run: passed, including exact score/event mapping.
- Jest browser integration suite: **34/34 passed** against the production build.
- Hosted game browser suite: **14/14 passed**.
- Race coverage suite: **814 passed**, 64 skipped; 90.28% line coverage.
- Repository `verify:all-targets`: passed, including isolated builds and browser
  checks for Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks.
- Security, locale, license, SDK-boundary, and artifact audits: passed.
- Expected local warning only: Node 24 was used while Firebase Functions declares
  Node 22.

The source repairs are not part of the inactive deployed build named above.
They are production-built and fully verified locally, but need a normal Jest
release before the repaired busy states can be rechecked on the live platform.

## Release readiness

The non-mutating Jest release plan and local uploader preflight both passed.
The current production artifact contains 420 ZIP entries, is 2.64 MB, and has
SHA-256 `50661ed3ae017bdff8868b99265a31ca3c02059bb5349925193587e41d5902a7`.
Its artifact audit and W3C validation completed with zero findings.

No upload was attempted. The hardened release command correctly blocks this
artifact while the verified source and evidence remain uncommitted, and the
real command would upload and automatically activate the processed build.
Committing the reviewed changes and invoking that external release therefore
remain explicit owner actions.

## Screenshot evidence

### Player 1

- [Multiplayer lobby](./live-01-player-1-lobby.png)
- [Race started](./live-02-player-1-race-started.png)
- [Race finished](./live-02-player-1-race-finished.png)
- [Authoritative run recorded](./live-03-player-1-completed.png)
- [Share requested](./live-04-player-1-share-requested.png)
- [Jest share transition](./live-04-player-1-share-dialog.png)
- [Published challenge ready](./live-04b-player-1-challenge-ready.png)

### Player 2

- [Invite with Player 1's score](./live-05-player-2-invite-ready.png)
- [Race started with opponent rail](./live-06-player-2-race-started.png)
- [Final opponent-win result](./live-06-player-2-race-finished.png)

The OS contact picker is not available in headless Chromium. The test instead
verifies Jest's referral response, opens its returned URL in Player 2's isolated
context, and validates the entry payload end to end.
