# Retired avatar preparation: skip later image stages

The existing avatar ownership guard correctly prevented an obsolete image from reaching the host, but still allocated a canvas, drew, encoded and read the image after its account visit or selection retired. Cooperative cancellation now skips subsequent stages while preserving the existing request ownership guard, validation limits, crop, WebP format and bitmap cleanup.

Evidence and reproducible captures are in `artifacts/avatar-preparation-cancellation-2026-10-05/`. `report-generation.py` checks the results, captured sources, source inventory, build hashes, registration and Firefox records before generating `verification-summary.json` and the scoped `own.diff`.

## Diagnosis and controlled change

The injected fixture uses the actual `useGameOperations`, session reducer, bridge schema, native browser decoder, canvas encoder and FileReader. Its image comes from the game's bundled `riddlequest-r.webp`; it uses mock account identities and records outgoing request metadata without contacting an avatar API or using a user's photo. It holds delivery of a native decoded bitmap or a native encoder callback to retire the selection at a deterministic boundary. These holds do not measure elapsed performance or interrupt native decoding/encoding.

Canvas allocation, draw, encode and read counters expose redundant work even when the existing ownership guard suppresses the host request. A repeated minimal account-change case produced the same eight failed counter assertions. The 13-case expanded original probe produced 54 failed assertions out of 286; the helper-only change produced the same result until the hook supplied lifecycle cancellation. The connected implementation passed all 286 assertions.

| Probe | Checks | Failed |
| --- | ---: | ---: |
| Original minimal | 22 | 8 |
| Original repeat | 22 | 8 |
| Original expanded | 286 | 54 |
| Helper only | 286 | 54 |
| Connected cancellation | 286 | 0 |
| Final development | 858 | 0 |
| Final production | 858 | 0 |
| Existing ownership development | 420 | 0 |
| Existing ownership production | 420 | 0 |

The complete fixture covers active preparation, 32 unrelated updates, account replacement, generation replacement, sender replacement, unmount/remount, account return, newer selections, obsolete decoder failure, current decoder failure, and cancellation during encoding by account replacement, a newer selection or unmount. Every journey also checks a current replacement, validation errors, native bitmap release, bridge-valid WebP delivery and browser errors. Three viewports are exercised: 390×568, 390×844 and 1280×844. Both fixtures are registered in the main game browser command; the new fixture runs both React development and production modes.

## Implementation

- `prepareAvatarImage` accepts an optional signal and checks it before starting decoding, after the decoder resolves inside the bitmap cleanup scope, and after encoding resolves before allocating a FileReader.
- Each committed avatar owner tracks its current preparation controller. A newer selection or layout cleanup aborts that preparation. Its `finally` clears only its own controller, so an older completion cannot clear a newer selection's cancellation owner.
- The existing scope, sequence and render-time identity checks remain in place. Current failures still reach the caller; obsolete failures remain quiet. The optional signal preserves existing callers without a signal.

These checks cannot interrupt a native decoder or encoder already running. They prevent remaining work after those operations complete. A FileReader that has already started continues to finish; host delivery still requires current ownership. Requests already sent to the authority are unaffected. No network latency or frame-time speedup is claimed.

## Verification

The final runs passed 1,716 focused and 840 related browser assertions (2,556 total). Six Firefox records independently show the original retired decoder doing all four image stages, the repair skipping all four, a fresh current WebP upload, retirement during native encoding skipping the read, successful preparation after remount, and preserved invalid-file rejection. All have zero browser errors and unhandled rejections. Native interactions used the fixture's visible buttons; delayed callback releases used its explicit probe controls.

Portal verification passed 2,761 unit tests across 297 suites, including three added cancellation/resource checks; 15 suites and 93 tests remain intentionally skipped by the existing configuration. Type checks passed. The documentation audit passed 25,237 declarations across 1,140 files.

All six isolated artifacts built and passed their artifact audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. **YouTube was the fixture build, not release certification.** Eight built-game tests across hosted gameplay, profile and Reddit suites passed against these exact new temporary artifacts in 86.468 seconds. Existing latency limits were unchanged. No target adapters, authority protocol, locales, provider SDK boundaries or product copy were changed.

The 1,504 selected source/build inputs were re-enumerated and hashed before and after verification; there were no changes. All 1,300 built files were preserved under this evidence directory and their hashes matched the temporary outputs. The exact temporary build root was then removed. The scoped reverse patch check passed; unrelated shared-checkout work is excluded from `own.diff`.

All verification job handles reached terminal status. Both Firefox servers were intentionally stopped with SIGINT (outer handles reported 130); their fixture `finally` cleanup removed the exact caches and no owned fixture process remained. The three created Firefox tabs were closed, leaving the original blank tab.

The initial syntax-check invocation omitted the repository's pnpm dependency-verification opt-out and failed trying to open its dependency database. Subsequent commands used the required flag; no successful dependency installation was performed. Initial probe outputs used a report path relative to pnpm's package working directory; those exact completed outputs were relocated into this evidence directory before comparisons. The final registered runs use the fixture's default absolute report destination.

The broad game-improvement goal remains active. In particular, earlier stressed buffered-transition timing observations still do not identify a single causal bottleneck; this work establishes avoided image stages rather than resolving that separate timing investigation.
