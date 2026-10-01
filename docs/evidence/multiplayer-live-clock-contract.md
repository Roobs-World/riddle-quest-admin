# Multiplayer live clock contract

30 September 2026 local development evidence. Named HTML5 platform artifacts only;
no standalone web/PWA release, UI copy changes or translation edits.

## Reproduced failures and correction

Nineteen new regressions failed before correction: six shared schema cases, eight
cached reply emulator cases across legacy and versioned records, and five client
initial/recovery cases. Active clock fields could each have valid shapes while
claiming a duration different from the sampled server time minus the fixed start.
A damaged historical wrong-guess receipt could replay a phantom duration without
scoring events; a delivered recovery response could replace the player's clock.

The shared response contract requires zero scored duration during preparation and
countdown, a scheduled sample strictly before its start, and active duration equal
to sample minus start. Cached reply acceptance uses the canonical owned start when
an older reply omits it. Client acceptance likewise uses the privately retained
start across compatible omitted metadata. Terminal durations remain fixed and can
be clamped independently of later reads; legacy absent clock metadata is supported.

The injected fake authority now samples time once for lifecycle, wall duration and
response timestamp. Existing positive session fixtures explicitly author authority
samples for projected views rather than submitting stale timestamps alongside
locally advanced duration. Intentional corruption remains unnormalized.

## Verification

Focused checks passed 159 core cases, 110 backend acceptance/replay cases and 361
client race cases. The real multiplayer UI passed at 1280px and 390px: reject a
contradictory wrong-guess reply, restore the typed input, retry an owned read, then
retain the draft without submitting another guess or charging a hint. Screenshots
are under `artifacts/race-clock/`; the recovered mobile view was visually inspected.
The locale browser harness also now authors a consistent initial ready clock and
passed both viewports. The clock harness validates the otherwise-correct reply
before altering its clock, ensuring rejection exercises the intended contract.
The first fourteen-check run passed every check but correctly withheld its
completion record because the harness was corrected while verification ran; the
recording must be repeated against stable source.

Stable completion recording uses
`docs/development-tasks/race-live-clock-contract.json` with full backend emulator
coverage, client/core checks, type checks, injected UI verification, all seven
isolated artifacts and dependency/security/scalability/documentation safeguards.
A completed dashboard row is warranted only if that recording succeeds against
unchanged source. No upload, activation, game publication or Functions deployment
is performed by these checks. Jest activation is authorized; game publication,
review submission and listing visibility remain on hold. Firebase Functions may
be deployed separately within the user's authorization.
