# Checkpoint delivery when a host writer becomes available

On 6 October 2026, the mounted hosted single-player game could keep a typed draft visible without delivering it to storage after the host supplied its previously missing save callback. The fix now delivers the latest confirmed projection once when that writer becomes available, including completed-game clears and a checkpoint requested while backgrounded. Normal callback rerenders retain duplicate suppression.

This is one verified improvement within the continuing multiplayer and single-player reliability, performance, playability and latency goal. It does not establish completion of that wider goal, production deployment, or a reduction in real network latency.

## Reproduction and diagnosis

The initial probe builds and mounts the actual `PlayHostApp`, `createHostedPlaySession`, fake authority services, and `PlayerProjectionPersistence`. Only the target storage boundary is an in-memory asynchronous `PlatformStorage`. It uses a native Chromium keyboard edit, ordinary React effects and the real persistence queue. It does not fake the checkpoint hook or postpone React effects manually.

Both development and production reproductions showed:

- The board still displayed `P` after the host attached `onPlayerDataChange`.
- The authority question was read once, with no board reset or browser errors.
- Only a profile update reached the queue. Durable `activeGame` remained `null`, even after the queue flushed.

The ranked hypotheses were observed-progress duplicate suppression, host reassembly, and a dropped queue update. The focused regression also writes the same current reducer projection directly through `PlayerProjectionPersistence` while the hook writer is missing. That control succeeds, narrowing the failure to delivery before the queue.

Two layers contributed. `GameSessionCheckpoints` records its observed signature independently of delivery. The React adapter previously ignored a save decision if its optional writer was missing. In addition, `PlayHostApp` always passed a callback whose body used optional chaining on `onPlayerDataChange`; that callback silently did nothing when storage was unavailable. A hook-only first fix remained red in both React modes, demonstrating why the mounted host boundary mattered.

The maintained regression harness loads captured baseline versions of both production files. Four focused baseline scenarios produce **7 failed assertions out of 33**: late host writer, late hook writer, unavailable background writer, and late completed-game clear. The final sources pass those scenarios and the wider matrix.

Raw baseline logs are `probe-red-development-corrected.log` and `probe-red-production.log`; final original-probe logs are `probe-terminal-development.log` and `probe-terminal-production.log` in the evidence directory. The per-mode original-probe JSON and PNG files contain the final green observations; the raw logs preserve the original red values.

## Change

The production edits are limited to two files:

- `packages/portal/src/play/PlayHostApp.tsx` exposes an absent `onSaveGame` when the host has no `onPlayerDataChange` writer.
- `packages/portal/src/play/game/hooks/useGameSessionPersistence.ts` remembers a missed save using only its originating UID and account generation. When a writer becomes available, it projects the current confirmed reducer state through the existing `createSavedGame` function. It does not retain an obsolete payload. Account replacement discards the marker, restoration still precedes saving, and existing rollback logic removes unconfirmed hint/guess/continuation state from the projection.

The background handler records unavailable deliveries through the same marker. A successful committed background write clears it, preventing a second recovery write during the subsequent foreground effect. Existing committed listener ownership and speculative-account rejection remain intact.

There is no new timer, authority request, queue implementation, provider SDK, visible copy, fallback storage, or economy grant. The marker remains bounded while a writer stays unavailable. Failure after a projection enters storage remains the responsibility of the existing durability queue and provider recovery policy.

The other two owned source records register and implement the maintained browser regression:

- `packages/portal/scripts/verify-checkpoint-writer-recovery-browser.mjs`
- `packages/portal/package.json`, including `test:checkpoint-writer-recovery:browser` and the aggregate browser command

## Fresh validation

| Validation | Result |
| --- | --- |
| New mounted regression | **228 cases, 1,896 assertions, 228 screenshots**, all green |
| Background checkpoint ownership controls | **54 cases, 360 assertions**, all green |
| Projection serialization controls | **4 viewport runs, 64 assertions**, all green |
| Full portal unit suite | **2,898 passed**, 93 intentionally skipped; 301 passing suites and 15 skipped suites |
| Built Jest/Reddit smoke tests | **8 tests across 3 suites**, all green |
| Built Facebook smoke test | **1 test**, green |
| Original full-host probe | Development and production green after the final source freeze |
| Types, target boundaries, security, TSDoc and source sizes | All green |
| Isolated artifacts | Jest, Facebook, Reddit, YouTube fixture, Netflix candidate and Yahoo candidate built and audited; Devvit server built |

The new matrix runs StrictMode in both development and production, in Chromium **153.0.8010.12** and native Firefox **153.0**, at **390×568**, **390×844** and **1280×844**. It exercises the actual host callsite and actual hook/reducer/controlled board/keyboard with the real projection queue. Its 19 scenarios cover late availability, removal and return, restored drafts, completed outcomes, question replacement, UID and generation replacement, background requests, commit-time background delivery, unmount, 32 callback rerenders, continued absence, unconfirmed hints, a failed storage write, direct queue admission, and untouched-question suppression. External traffic, browser errors and unhandled rejections are checked.

Normal callback rerenders produce no additional checkpoint deliveries. The existing full-host instrumentation confirms that presentation changes produce **zero additional saved-game copies and zero fingerprint serializations**, while real input and background signals still produce their intended projections. No server latency measurement is inferred from these checks.

The Firefox MCP information call still returned `Process (pid=757831) unexpectedly closed with status 0`. This is recorded in `firefox-mcp-check.json`; Firefox coverage above comes from the native maintained injected harness, not that failed MCP connection. The tested executable was `/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox`.

The first probe fixture incorrectly called the nonexistent `updatePlayer` method; the first maintained harness fixture selected a nonexistent `.keyboard-key` class. Their failed preflight logs remain preserved. Corrected fixtures use `PlayerProjectionPersistence.update` and the actual `.keyboard .key` controls. Neither preflight is counted as a reproduced production failure or a passing check. The misleadingly named `probe-green-development.log` and `probe-green-production.log` record the failed hook-only intermediate implementation, not the final fix.

## Authority, isolation and provenance

The pass froze **2,448 selected source/configuration/content/compiled inputs**. All earlier 2,447 inputs remain present, exactly three existing owned files changed, and only the new maintained regression script was added to that selection. Captured before/after hashes, `owned.diff`, and a successful reverse-apply check isolate this pass from the accumulated dirty checkout. Source manifests match before builds, after builds, after runtime tests and at terminal verification. No source changes occurred after the freeze.

The prior authoritative results are **reused, not freshly rerun**: 391 core tests, 1,730 backend tests, 677 actual-SDK integration tests and 17 Node 22 SDK tests. Every one of the **824 selected authority/configuration/compiled inputs** is unchanged, all reused log hashes match, and all **24 canonical/installed Functions core-copy comparisons** still match. This proof does not claim that every backend suite was rerun or that these client checks certify production authentication.

Six dependency inventories and **1,301 built files** are preserved with SHA-256 hashes. The hosted checkpoint hook and host callsite occur in Jest, Facebook and Reddit inventories; neither is present in the standalone YouTube, Netflix or Yahoo graphs. Artifact audits validate the target isolation rules. Facebook advertising modules remain absent from the other five targets; Reddit and standalone graphs contain no Firebase; standalone graphs contain no live multiplayer or hosted provider packages. Locale checks validate all 16 locales without new production copy.

**YouTube was built using the explicitly permitted incomplete-content fixture command. This is not a YouTube release-content certification.** Netflix and Yahoo remain provider-neutral candidates. This pass did not deploy or publish anything. The earlier multiplayer retirement protocol still requires its backend/callable/Devvit route and TTL deployment before updated clients are deployed; see the live same-account retirement report.

All **18 tracked jobs** have terminal exit statuses, including expected red/preflight jobs. After runtime work finished, the owned temporary build tree was copied and verified, its six inventory records were preserved, and only that tree and those exact metadata files were removed. The Facebook smoke harness removed its own separate build tree; its one additional inventory was also preserved before removing its exact metadata file. Owned browser scratch roots were removed and browser/server lifetimes closed by their harnesses. Unrelated artifacts were not deleted.

Evidence is in `artifacts/checkpoint-writer-recovery-2026-10-06/`. Reproduce the final evidence audit from the repository root with:

```sh
python3 artifacts/checkpoint-writer-recovery-2026-10-06/verify.py
```

The audit checks current source hashes, owned changes, actual terminal statuses, fresh test results, red/green observations, authority reuse, compiled copies, all six inventories, every preserved build hash and cleanup. It is specific to this frozen source state; later goal edits require their own evidence rather than reusing this verifier as if it certified newer source.
