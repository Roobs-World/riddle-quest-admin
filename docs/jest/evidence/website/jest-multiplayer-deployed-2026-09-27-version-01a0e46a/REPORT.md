# Jest multiplayer deployed verification — 2026-09-27

Status: **passed on the repaired deployed build; exact opponent score mapping verified.**

## Build under test

- URL: `https://jest.com/g/riddle-q?versionId=01a0e46a-3801-760b-9b90-c8b745a87d4e&rl=4884f7`
- Jest version ID: `01a0e46a-3801-760b-9b90-c8b745a87d4e`
- Build: `1.0.0-dev.20260927192937.83a313b3c60d.0812ecf8`
- Source commit: `83a313b3c60d17e8b89e24d4ee083a6426bbb3ff`
- Release ZIP SHA-256: `7b6d6963fc0d2c133e27d6bb984d035adb58a5216138566110dbe2854be2316a`
- Host viewport: 520 × 932
- Game iframe viewport: 424 × 692
- Browser: headless Chromium in the live Jest shell

The canonical release gate passed and Jest accepted the immutable upload with
HTTP 202. Jest MCP reported the uploaded version `ready` with no processing
error. Because automatic activation did not settle after repeated checks, the
exact ready version was released once through the Jest MCP release operation.
`get_game_details` then confirmed the draft revision's `activeVersionId` is the
new version.

The game is still under review. Its in-review revision remains pinned to the
older reviewed build, so this report does not claim that the review revision or
public published revision changed. The exact new draft version URL above was
used for every deployed check.

Two separate registered Jest sandbox accounts were used. Credentials, raw
login links, player IDs, referral URLs, challenge IDs, and App Check values are
not stored in this evidence directory.

## End-to-end result

1. Player 1 opened Multiplayer, selected History, and completed 10/10.
2. The server-authoritative adjusted finish was **35,234 ms**, with no hint or
   skip penalties.
3. Player 1 published the completed run and opened the real Jest sharing flow.
4. Player 2 followed Jest's returned referral in a separate authenticated
   browser context and received Player 1's challenge.
5. Player 2 accepted the invite and played against Player 1's recorded run.
6. Player 2 reached 10/10 in **23.6 seconds**, ahead of the recording; the game
   displayed **You win!** and the opponent rail showed 5/10 at that instant.

## Opponent-score integrity

The verification used the authoritative payloads rather than relying only on
rounded UI text. It asserted that:

- Player 2 received the same opaque challenge Player 1 published.
- The invite creator matched the opponent shown during the race.
- Player 1's completed run contained exactly ten correct score events.
- Player 2's opponent recording contained the same ten events.
- Both payloads carried the exact adjusted finish time **35,234 ms**.
- The invite correctly rounded the immutable score to **0:35.2**.
- The terminal result agreed with the timelines: Player 2 won before the ghost
  completed its remaining events.

Machine-readable, privacy-safe assertions are in [RESULT.json](RESULT.json).

## Repaired behavior verified by this build

This is the first deployed two-player run containing the multiplayer feedback
repairs. The released source includes:

- immediate projected race results while server reconciliation continues;
- queued score publication when outcome reconciliation is still in flight;
- action-specific busy feedback and duplicate-call protection for Jest sharing;
- visible background activity for hint, skip, outcome, and publication work;
- busy feedback for matchmaking, context selection, block, report, and quit;
- safe abandonment when a player closes during a delayed authoritative start;
- horizontal containment at narrow mobile widths.

The live screenshots show the complete lobby, race, completed-run, sharing,
invite, opponent-race, and terminal-result flow without horizontal clipping.
The exact deployed artifact smoke also passed before this multiplayer run.

The intentionally delayed edge cases cannot be forced against production
without interfering with live server behavior. They are covered by the same
production-built browser suite: 34/34 Jest authentication/multiplayer flows and
14/14 hosted-game flows passed, including queued publication, provider-share
busy state, delayed outcome navigation, safety-action busy state, and delayed
start cleanup. Immediate local feedback measured 2.4–9.5 ms while responses
were deliberately held.

## Findings

### No blocking game defect found in the released two-player journey

Both accounts authenticated, publication completed, the referral resolved, the
correct opponent recording loaded, both races completed, and the result matched
the authoritative timelines. There were no browser page exceptions.

### Operational observation — activation views represent different revisions

After upload, `list_game_versions` continued to describe the older in-review
version as active even after the release operation succeeded. The more detailed
game record showed why: the new version is active on the draft revision, while
the in-review revision intentionally retains its previously submitted version.
Release checks must identify which revision they mean instead of treating a
single `isActive` field as the whole game state.

### Non-blocking Jest host diagnostics

- Both players logged the browser's sandboxed Storage Access API refusal because
  the host iframe does not include `allow-storage-access-by-user-activation`.
- Server-event subscriptions were aborted during navigation, as expected when
  the page changed.
- Player 1 saw one reset while Jest loaded a CDN avatar. The avatar is host UI;
  the game and challenge continued normally.

These host diagnostics did not affect identity, server-authoritative gameplay,
sharing, referral resolution, score replay, or completion.

## Release verification

- Canonical `pnpm release:jest` production gate: passed.
- Mobile stability soak: passed in **601.9 seconds**; responsive and
  memory-bounded.
- Release artifact: 419 ZIP entries, 2.64 MB; Jest artifact and W3C validation
  passed with zero findings.
- Exact deployed artifact smoke: **1/1 passed**.
- Live two-account multiplayer journey: passed.
- Exact opponent event/time mapping: passed.
- Required production gameplay Functions: all seven `ACTIVE` in the same
  deployment cohort before release.

The release receipt barrier remains retained for the documented Console/email
audit trail; it was not deleted merely from elapsed time.

## Screenshot evidence

### Player 1

- [Multiplayer lobby](live-01-player-1-lobby.png)
- [Race started](live-02-player-1-race-started.png)
- [Race finished](live-02-player-1-race-finished.png)
- [Authoritative run recorded](live-03-player-1-completed.png)
- [Share requested with immediate feedback](live-04-player-1-share-requested.png)
- [Jest share transition](live-04-player-1-share-dialog.png)
- [Published challenge ready](live-04b-player-1-challenge-ready.png)

### Player 2

- [Invite showing Player 1's score](live-05-player-2-invite-ready.png)
- [Race started with opponent rail](live-06-player-2-race-started.png)
- [Winning terminal result](live-06-player-2-race-finished.png)

The OS contact picker is unavailable in headless Chromium. The test instead
validated Jest's real share response, opened its returned referral URL in Player
2's isolated context, and verified the resulting entry payload end to end.
