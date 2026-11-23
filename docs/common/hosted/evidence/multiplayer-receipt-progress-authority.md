# Multiplayer receipt progress authority

30 September 2026 local development evidence. Release scope remains named HTML5
platform artifacts, excluding standalone web/PWA builds. This change does not
modify visible UI text, translations or production data.

## Reproduced progress contradictions

Eight of nine public-interface demo-emulator cases failed before correction.
An accepted hint was retried after a later skip advanced canonical progress.
Damaging its cached response could return a phantom score, erased or invented
charges, altered accepted event clocks, a terminal state before completion,
preparation after a paid action, inconsistent clock arithmetic or a future
accepted response clock. The existing transport schema already rejected the
unsafe-integer case; that protection is retained rather than attributed to this
change.

## Historical checkpoints remain possible

Receipt progress now uses canonical upper bounds and its own retained history.
Scores and penalties cannot exceed accepted run progress. Active scoring replies
must expose their owned current question and obey score/position rules; modern
clearing counts are exact, while supported legacy non-clearing skips remain
compatible. Abandonment cannot masquerade as gameplay or a competitive result.
Terminal cached measurements must match the immutable accepted terminal source.
Active historical replies can correctly lag later completion.

Copied events must agree with any retained canonical events at the same sequence
and satisfy shared timeline constraints. Known accepted action/receipt clocks
bound copied sampling metadata without inventing missing historical clocks.
Clock arithmetic uses safe integers. Clearing and paid actions retain their
expected final event type and exact charged aggregate; guess correctness and
automatic-skip flags cannot both claim success. A valid older response is returned
unchanged, rather than regenerated from today's question.

Complete terminal measurements remain distinct from deadline clamping. Paid hints
and skips can legitimately retain an event wall clock later than the clamped
terminal duration. The validator permits this supported ordering and does not
silently reject those already accepted actions.

## Verification

Nine public-interface cases check failed replay, unchanged canonical run/account/
receipt state, explicit repair and concurrent exact historical replay after later
progress. Seven real-engine compatibility cases cover hint ghost loss, skip
maximum timeout, final correct/paid clearing actions and prepared/scheduled/active
abandonment. Older pure receipt fixtures now pass their actual post-action owned
run to validation instead of an unrelated pre-action fixture; their original
intent and compatibility assertions remain. All 73 focused cases passed.

Stable-source recording uses
`docs/common/development/development-tasks/race-receipt-progress-authority.json`: Node 22 backend and
operator safeguards, full race coverage, types/lint, client recovery, seven isolated
artifacts and dependency evidence, security, scalability, file-size and TSDoc
gates. Its verified receipt updates the local development dashboard. The broader
multiplayer reliability goal remains active, and production rollout requires
separate evidence.
