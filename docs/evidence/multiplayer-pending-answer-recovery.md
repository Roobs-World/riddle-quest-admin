# Multiplayer pending answer recovery

The ongoing multiplayer edge-case and reliability audit remains active. This
batch extends the pending private-command ownership verification with recovery
of deliberate input typed while a wrong-guess confirmation is outstanding.

## Reproduction and behavior

A wrong-guess projection lets the player start typing the next attempt on the same
question. If its confirmation failed, the immediate rollback restored the submitted
answer, but a later canonical resume also retained that old submission and dropped
the new draft. Initial regressions failed eight of ten cases: three pending-draft
recoveries plus five invalid slot selections. The no-edit and advanced-question
controls already passed. Two additional regressions showed that ignored input
could discard the retained recovery draft before Retry.

RacePlay now records deliberate edits while it owns a guess checkpoint. Rejection
retains the edited draft independently and still immediately restores the submitted
answer and original confirmed history. Canonical resume restores that draft only
for the same run, question ID, deck position and answer shape. It accepts both an
applied wrong guess and an unapplied submission, respects deliberately emptied
input, and discards the draft when another tab advances. Same-question recovery
retains confirmed history rather than the unacknowledged optimistic guess row.
The retained draft is privately cloned. Invalid or ignored input cannot supersede
it; a real later edit can replace it.

Slot selection and input editing share the bounded pure input policy. Negative,
fractional, non-finite and oversized indexes are ignored, preventing sparse answer
arrays or non-index properties. Deletion also refuses an invalid active index.
No guess, hint or skip mutation is automatically repeated.

## Verification

Twelve public-session cases cover applied/unapplied wrong submissions, deliberately
emptied input, five invalid indexes, two ignored-input paths, no pending edits and
another tab's successor. The existing wrong-yellow feedback case still rejects
bad scoring and restores the original submission immediately; its canonical resume
now retains the typed `clo` draft on the same question. Private rollback tests still
assert the original run/input/history plus the explicit retained-draft metadata.
The complete client race suite passes 570 tests in 48 suites. Types, documentation
and maintainable source-size checks pass.

Eight desktop/mobile injected browser journeys use actual keyboard typing, Submit
and Retry. They hold a wrong-guess response, type or erase new input, reject the old
confirmation, and independently resume canonical same-question or successor state.
Every journey sends one guess and one recovery read, creates no extra race/paid
mutation, and has no browser exceptions. The 390px applied-wrong-guess screenshot
was visually inspected. The initial browser fixture's incorrect deck length was
corrected to use `RACE_RULES.deckSize`; no competitive validation was weakened.
No product text or locale keys changed.

The existing `docs/development-tasks/race-private-command-ownership.json` retains
all twenty-one checks and adds this browser harness as check twenty-two. This
combined verification also resolves its earlier pending ownership recording when
an unchanged source digest and all seven artifact hashes are confirmed. The
completion recorder must continue to refuse changed-source runs.

This batch does not commit, push, upload, activate/publish Jest, dispatch workflows,
deploy Firebase Functions or send messages to another chat. Jest activation is
authorized with publication held; Functions deployment is separately authorized.
The overall multiplayer reliability objective remains active.

## Completion recording attempts

The first full verification stopped on undocumented inline result types added to
concurrent Reddit presence tests. Documentation-only type aliases restored the
TSDoc gate and portal typing. Both `artifacts/race-pending-input/stable-validation.log`
and `latest-validation.log` then passed all twenty-two commands, including the
seven isolated builds, but refused completion because shared source changed during
verification. No receipt or dashboard completion row was recorded for the combined
task. The source-digest guard remains unchanged.

The ten retained submitted-feedback browser journeys also passed independently
in `retained-feedback-browser.log`, including wrong-yellow rejection and genuine
answer-free legacy recovery with no pending input edits. Formal dashboard recording
remains pending a stable-source run; the wider reliability audit remains active.
