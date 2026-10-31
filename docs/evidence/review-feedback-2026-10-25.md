# Review feedback fixes, 25 October 2026

Riddle Quest fixes are uploaded and activated as Jest build `1.0.0-dev.20261025-feedback-final`, version `01a17045-d20f-7599-ac28-477a7a9b90a6`.

[Open the preview](https://jest.com/g/riddle-q?versionId=01a17045-d20f-7599-ac28-477a7a9b90a6).

- Public matchmaking searches for six seconds and then starts the existing authoritative bot fallback. Bots have stable guest-style usernames. Existing long-wait seats recover through the same fallback. Private friend invitations keep their fifteen-minute lifetime and never receive bots.
- Public search time starts after content preparation. Entry has a bounded thirty-second cold-start allowance. Polls keep their two-second limit and other player commands keep their ten-second limit.
- Explicit Close waits for confirmed retirement before returning to category selection. Failed cleanup offers Retry, while the closed race remains disabled. Late original receipts keep their existing ownership rules.
- Classic Next Level no longer waits for a duplicate completion acknowledgement after the terminal guess has already committed progression. Daily acknowledgement requirements remain.
- Submit after a paid extra attempt accepts one queued click while the charge is pending. It sends through the ordinary guess path only after the matching successful receipt. Account, session, draft changes, rejection and terminal outcomes cancel it. The click itself is not replayed after reload.
- Redundant coin-pack descriptions and the repeated attempts paragraph are removed, including their unused keys in all sixteen locales.

## Validation and delivery

Production client and server TypeScript builds pass. Changed server files pass ESLint. Locale, platform-boundary, license, Jest manifest, artifact, module-cycle and function-capacity checks pass. The final HTML passes the pinned W3C validator with zero findings. Independent source review covered retirement ordering, private-lobby isolation and the paid-answer receipt path.

After explicit user authorization, 175 unit and server checks passed across 13 suites. These include 84 race lifecycle checks, 41 solo gameplay and completion checks, and 50 integration checks using isolated Firestore and Realtime Database emulators.

The silent browser matrix passed 42 race cases at 390 and 1280 pixels. It covers public-to-friend and friend-to-public entry, Click and Escape, held joins and retirement, transient failures, explicit Retry, late responses, and sixteen-second cold private entry. Restoring the old premature-close behavior or the old ten-second join limit makes the relevant check fail. The current application passes both controls.

Five gameplay scenarios passed against the processed Jest-hosted preview with mock gameplay data. They verify queued retry submission, cancellation on rejection or draft changes, Classic Next before completion acknowledgement, and shop copy. Every loss panel displays Out of Attempts once. The same five cases also pass locally against the exact uploaded artifact. All 419 local artifact files match the final ZIP without differences.

No further application changes were needed. No real invitations or purchases were sent. These checks use controlled provider responses and test data; they do not claim two-player delivery through a real messaging service.

The repeatable browser commands are `node packages/portal/scripts/verify-live-search-close-browser.mjs` and `node packages/portal/scripts/verify-review-feedback-browser.mjs`. Set `REVIEW_FEEDBACK_HOSTED_URL` to the hosted build content URL to run the latter against Jest. Both install silence before navigation. [Machine-readable results](review-feedback-2026-10-25-results.json) record the counts, fixture scope and artifact hash.

The `joinLiveRace` and `updateLiveRace` functions deployed successfully in `europe-west1` and `us-central1` for `riddle-quest-ec2b2`. The corrected client was activated after the user explicitly requested publication. Jest still reports `isPublished: false`, a draft revision, and no in-review revision. The submission Simulator stayed blank in the connected browser, leaving sixteen automated checks incomplete and its final submit button disabled. Reloading the app, using a fresh tab, and selecting Chrome mode did not recover it. No completed moderation submission or public publication is claimed. Temporary audio guards were cleared by leaving the Simulator and reloading the edit page.

[Submission blocker screenshot](review-feedback-2026-10-25-submission.png).

The connected Gmail account was searched and relevant messages read. Riddle Quest had no additional open player feedback in Jest beyond the six review items. A separate email dated 22 October reports that Puzzle Punks does not load; this belongs to another game and is not recorded as fixed by the Riddle Quest changes.

Final ZIP: 419 files, 2,878,287 compressed bytes. SHA-256: `d79cc0bef94181f4cc074b0e06e581561253adee6545ce6f7634882668f5f26b`.

## Production deployment verification

The corrected client is Active and Ready in Jest. Every hosted file was retrieved and compared with the tested artifact: 419 of 419 SHA-256 values match, totaling 4,715,843 bytes. One transient 503 response succeeded on its first retry. All four production race functions are ACTIVE, with successful regional builds and ready, healthy Cloud Run revisions. Their deployed race modules and schema bytes match the current built source. All four endpoints are reachable and correctly reject unauthenticated requests with HTTP 401. These checks did not change production gameplay data.

[Deployment verification](review-feedback-2026-10-25-deployment.json) and [active-version screenshot](review-feedback-2026-10-25-active.png).

The browser retry was made in a tab confirmed muted before navigation, with no added page scripts. It reproduced the blank Simulator frame. Browser diagnostics show the game HTML returned HTTP 200 but remained in a paused document response before frame commit. This separates successful artifact deployment from the browser connection's incomplete Simulator flow. The app remains unpublished, with no in-review revision.


## Later release readiness readback

[The current completion record](completion-readback-2026-10-25.md) supersedes this note's release status. The screenshot fix is already uploaded, Ready and active as version `01a17226-db08-708f-86a1-6733b1fe4824`. All 419 hosted files match. The official Simulator now passes all 20 Basic Launch checks after an ordinary reload recovered the blank frame. Review submission and publication remain separate; no submission is claimed.
