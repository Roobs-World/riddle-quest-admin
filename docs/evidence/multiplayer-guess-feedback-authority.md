# Multiplayer guess feedback authority

30 September 2026 local development evidence. Scope remains named HTML5 platform
artifacts, excluding standalone web/PWA builds. No visible UI text, locale keys or
production data are changed.

## Reproduced contradictions

Ten public-interface demo-emulator regressions failed before correction. Accepted
wrong, correct and automatic-skip guess receipts could replay changed positional
colours, merged grapheme feedback cells, or active wrong-guess counts of zero or
the already exhausted maximum. Original submitted letters and request bindings
alone did not prove their evaluation.

Four Turkish casing cases also showed a real first-acceptance mismatch: correctness
used the owned Turkish locale, while positional feedback defaulted to English.
`I` versus `ı`, `İ` versus `i`, and their reverse authored pairs were accepted as
correct but returned red feedback. Local multiplayer projection used the same
English default and could fail to advance before authority arrived.

## One evaluator across multiplayer

The shared positional evaluator accepts an optional locale and retains English as
its default for existing callers. Duplicate-letter accounting and NFC grapheme
normalization are preserved. Authoritative multiplayer scoring and private local
projection now pass the immutable run locale. Server scoring trims the submitted
guess before positional evaluation, matching its accepted grapheme/correctness
comparison and receipt identity.

Receipt validation resolves the original submitted question from the owned deck,
recomputes the exact feedback graphemes/statuses and checks the correctness flag.
An active non-clearing wrong guess must retain a real, unexhausted attempt count.
Damaged cached replies reject before replay-dependent writes; explicit repair
returns the original accepted reply to concurrent and supported unbound historical
retries without another guess or grant.

## Verification

The ten emulator cases cover six feedback/attempt contradictions, full unchanged
canonical account/run assertions, explicit repair, concurrent retries and legacy
receipt replay, plus four Turkish first-acceptance/replay pairs. The focused backend
compatibility gate passed 83 cases. Shared evaluator cases verify Turkish dotted/
dotless comparisons, duplicate counts, NFC equivalence and unchanged default
English behavior. The private gameplay test proves immediate successor projection
for the locale-equivalent guess and a retained wrong attempt for a distinct dotted
letter.

`packages/portal/scripts/verify-race-locale-browser.mjs` renders the actual
multiplayer UI with injected catalog and controlled authority adapters. At 1280px
and 390px, it enters a Turkish owned run, types `I`, holds the authority response,
asserts immediate transition to question two, then releases confirmation and checks
the same successor, no visible error and no browser exception. Screenshots are
saved under `artifacts/race-locale/`; the mobile projection was visually inspected.
An initial harness-only failure included preload hint metadata in the strict
current-prompt shape; that fixture was corrected before the successful gate.

The first full backend run passed 887 cases and failed a stale Reddit retrieval
cost assertion. Concurrent work introduced a twelve-document sparse-scope probe
before indexed retrieval; this test's old two-read expectation counted the former
single-document probe plus one comparable document. Actual lookup telemetry proves
thirteen physical reads, including the twelve probe records and the one indexed
match. A temporary confident-profile experiment still produced thirteen and was
removed after tracing the probe. The exact assertion now accounts for the actual
probe; its matched-recording, query, transaction and production budget safeguards
remain. This verification adjustment does not change matchmaking behavior and is
not attributed to the guess-feedback implementation.

Stable-source recording uses
`docs/development-tasks/race-guess-feedback-authority.json`: the eleven backend,
client, isolated-build and architecture safeguards, plus full core tests, portal
types and the injected locale browser journey. The receipt updates the local
development dashboard. The comprehensive multiplayer reliability goal remains
active; production rollout requires separate evidence.
