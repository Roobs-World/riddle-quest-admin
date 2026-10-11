# Reload while a live command receipt is pending — 2026-10-09

The current live UI loses independently typed post-submit input after a native reload when an accepted wrong guess's reply has not reached React. This is distinct from the completed unsent-draft recovery case.

The injected HTTP fixture accepts `zzzz`, then holds its browser-facing receipt. The original UI clears its next editable attempt and lets the player type `te`. The checkpoint contains that new prefix. Native reload and rejoin recover the accepted server state without replaying the original command, but the editable prefix becomes blank. The same case retains input while the component remains mounted in the existing reconnect behavior; reload currently loses it.

The storage reader requires exact accepted-guess count equality as part of its ownership binding. Static tracing explains the loss: the held receipt leaves the original accepted count in the UI view used for checkpointing, while rejoin observes the incremented authoritative count. It cannot distinguish a previously submitted stale draft from independent input composed after submission. This explanation is a code-path inference; the probe directly verifies the saved new letters, recovered authority and resulting blank editable cells.

For comparison, a held accepted hint preserves the new prefix and canonical hint lock on reload (the editable cells contain `e` and two blanks because `t` is now locked). A held accepted skip correctly resets the old-question prefix because authority advanced to another question. All three cases preserve server progress and do not redeliver their held player commands.

Chromium 153.0.8010.12 and Firefox 153.0, React development/production, widths 390/1280: 24 journeys, 168 assertions. Eight wrong-guess journeys reproduce independent input loss, eight hint journeys preserve it, and eight skip journeys reject old-question input. No browser errors or unhandled rejections occurred. Assertions intentionally describe current behavior, not desired post-submit recovery.

The browser process reached exit zero; its local servers, browsers and owned scratch roots were closed in finally. Three selected production inputs were hashed before launch and remained identical afterward. No production/UI source changed, so the latest full build/test evidence remains the preceding read-deduplication cohort. Run `python3 artifacts/live-pending-command-reload-2026-10-09/verify.py` from the repository root.

The next change needs an explicit local presentation marker for input composed after submission, independent of the accepted command itself. It must recover those unsent cells only for the same account/seat/run/language/question, while still rejecting consumed pre-submit checkpoints and changed questions. It must never persist or replay a transport command as a consequence of draft restoration. Denied checkpoint writes, definitive command rejection and another writer's replacement must remain safe.

This uses an injected legacy transport and fixture authority, not a production provider or Firebase transaction. No cloud latency, natural reload frequency, deployment or end-to-end production recovery is claimed. The broader game improvement goal remains active.
