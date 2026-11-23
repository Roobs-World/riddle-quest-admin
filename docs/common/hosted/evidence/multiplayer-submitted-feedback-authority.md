# Multiplayer submitted feedback authority

1 October 2026 local development evidence. Work remains confined to named HTML5
platform artifacts; no standalone web/PWA build, visible copy or locale changes.

## Reproduced failure and correction

Nine public-session cases accepted malformed submitted feedback before this change;
three compatible legacy/Unicode controls passed. Malformed receipts included empty
or short feedback, different or merged grapheme echoes, contradictory correctness,
and changed positional colors for correct and incorrect answers. Validation now
runs before consuming the original submission checkpoint. It compares feedback
length and each echoed grapheme with the actual submitted letters using the owned
locale, NFC normalization and casing. Correctness must agree with all-green
feedback. When the original prompt or immutable deck owns an answer, the existing
shared evaluator also proves each positional color.

Legacy answer-free replies remain supported: their shape, echoed letters and
correctness relationship are checked, but exact non-green colors cannot be
recomputed without an owned answer. Equivalent decomposed and uppercase Unicode
echoes are accepted. Validation uses the submitted draft rather than any successor
letters typed while authority is in flight.

Rejected acknowledgements restore the original question and submitted answer.
One explicit resume reads untouched canonical authority without resubmitting the
guess. A successful correct-answer recovery preserves the successor draft; an
incorrect-answer recovery keeps the submitted draft on the original question.
Direct confirmation with neither an original question nor a private checkpoint
now rejects explicitly instead of silently accepting an unowned completion.

## Verification

Twelve new public-session cases cover seven modern corruptions, two invalid and
one valid answer-free legacy reply, and two compatible Unicode echoes. The full
client race suite passes 495 tests across 38 suites. Two old success fixtures now
carry the real five-letter green feedback instead of an empty array. The outcome
minimum-progress fixture now preserves its issued wall clock when adding paid
time, removing an intermittent one-millisecond inconsistency without weakening
its malformed-outcome checks.

The injected harness renders the actual multiplayer UI at 1280px and 390px for
short feedback, changed letters, changed correct colors, changed incorrect colors
and legacy short feedback. All ten journeys reject the bad acknowledgement,
restore input, recover with exactly one resume and retain exactly one guess
submission, with no browser errors. The recovered mobile successor screenshot
was visually inspected. Portal types and the declaration documentation audit pass.

Stable-source comprehensive verification is defined in
`docs/common/development/development-tasks/race-submitted-feedback-authority.json`: all 15 backend,
client, core, isolated-build, dependency and architecture gates must pass before
a completion receipt updates the dashboard. Receipt artifact hashes bind all
seven isolated targets to the verified source.

This local batch performs no commit, push, build upload, activation, publication,
workflow dispatch or deployment. Jest activation is authorized while publication
remains held; Firebase Functions deployment is authorized separately. The ongoing
multiplayer reliability audit remains active.
