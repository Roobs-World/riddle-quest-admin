# Avatar preparation ownership — 5 October 2026

Avatar preparation in `useGameOperations` now belongs to the committed account generation, target sender and game lifetime that started it. An upload finishing after a player change, generation change, sender replacement, unmount, or departure and return to the same player is discarded before host delivery. A newer selection also supersedes an earlier unfinished preparation. Errors from retired or superseded work are ignored; errors for the current selection retain their existing behavior.

Ordinary parent updates keep an active upload alive. The existing image validation, decoding, cropping, encoding, bitmap cleanup, request ID creation and server-authoritative avatar update path are preserved. No product copy, locale key, provider SDK, authority rule or target boundary changed.

## Diagnosis and controlled probes

The original async callback awaited `prepareAvatarImage` and then sent through its captured sender without checking whether its account visit was still current. A browser fixture drove the real hook with a real game-owned WebP file, actual ImageBitmap decoding, canvas encoding, FileReader and bridge payload validation. It held the native decoded bitmap at the decoder boundary to make the race deterministic. Only the fixture recorded outgoing messages; no avatar service endpoint was called.

The initial minimal run produced 28 assertions / three failures. One invalid-file assertion counted a preceding stale send; its control was corrected to compare before/after request counts. The corrected minimal run produced 28 / two failures, while its live-upload and validation controls passed. Expanding the frozen original to ten cases produced 140 assertions / 13 failures.

One-variable prototypes isolated the behavior:

- Account, sender and committed lifetime guard: 140 assertions / three failures remaining (superseded selection and late failure).
- Added selection ordering: 140 / one remaining late-error failure.
- Added current-selection error ownership: 140 / zero failures.

The production implementation uses an immutable account/sender scope, a fresh token for each committed lifetime, and a per-lifetime selection counter. It checks ownership before preparation, after preparation, and before reporting a preparation error. Layout cleanup retires the token before passive effects detach. Render-time account identity also blocks a late result during replacement rendering.

## Verification

- Development and production React in StrictMode: 420 assertions per mode, 840 total, zero failures over 60 journeys at 390 × 568, 390 × 844 and 1280 × 844. Cases cover active upload, 32 native parent updates, player/generation/sender changes, unmount and fresh remount, returning player, concurrent selections, retired decoding failure and current decoding failure. Every case verifies fresh delivery, current identity, WebP payload validation, bitmap release, invalid-file rejection and browser errors.
- Firefox MCP independently reproduced the original upload being forwarded to player B after player A's held preparation. The fixed path sent nothing for that old preparation, then delivered a fresh upload once. It also dropped a superseded selection and an upload finishing after game retirement, suppressed a late failure after generation replacement, and preserved the current invalid-file error. Eight verified records contained no browser errors or unhandled rejection.
- On injected decoder failure the fixture closes its held bitmap before rejecting. Successful encoding uses the unchanged production helper's bitmap cleanup. This is not a claim that a failed native decoder returns a bitmap.
- The related compiled-source leaderboard request verifier passed at 320 and 1280 pixels, including callback replacement, retry, metric changes, stale failure handling and focus restoration.
- Eight built-game tests across three suites passed against newly built Jest/Reddit artifacts, covering hosted gameplay/navigation, Profile walkthrough and Reddit flows. Existing latency assertions were unchanged.
- Portal unit tests: 2,758 passed in 297 suites. Types and TSDoc passed (25,224 documented declarations across 1,140 files).
- All six isolated target builds and artifact audits passed. YouTube used the explicit fixture build; this is not YouTube release certification.
- 1,503 selected source inputs remained unchanged throughout final verification. Captured after-files match current source. The verifier is registered for both React modes and in the main browser command.

All 1,300 built files were preserved and hash-checked before removing the unique temporary output directory. Both Firefox servers exited successfully, their fixture caches were removed, and only this pass's tabs were closed. Exact changes, raw observations, screenshots, logs, source captures, prototypes, Firefox records and `verification-summary.json` are under `artifacts/avatar-preparation-ownership-2026-10-05/`.

The fix prevents obsolete work from emitting an avatar request or overwriting the current selection's error. It does not abort native image processing already in progress or cancel an upload already sent to authority, and no end-to-end speedup is claimed. The broader reliability, performance, playability and latency goal remains active. No commit, push, deployment or live account update was made.
