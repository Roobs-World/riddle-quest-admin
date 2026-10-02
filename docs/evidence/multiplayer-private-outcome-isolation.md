# Multiplayer private confirmed result isolation

The ongoing multiplayer reliability audit remains active. This batch protects
settled competitive results from consumers retaining mutable presentation objects.

## Reproduction and change

A confirmed outcome was previously pinned by keeping its public state reference.
A rendering consumer or completion adapter could mutate that object and thereby
change the baseline used for repeated result reads. The publication validator also
read the mutable displayed finish clock. Five regression cases failed before the
fix: canonical rereads/publications could be rejected, changed finish facts matching
the edited public reference could be accepted, and a provider callback could poison
the accepted result. The reward-refresh control already passed.

The session now privately clones every accepted outcome before notifying consumers.
That copy is reset with disposal, new attempts, rematches and unscored abandonment.
Subsequent result reads retain its competitive facts, while legitimate reward
presentation updates remain accepted. Result reconciliation uses the private
confirmed run and restores canonical identity and clock fields. Publication uses
the private completed recording and settled outcome; successful publication also
restores independently copied canonical presentation. No public reference aliases
the private baseline. Completion and publication effects remain once per owned run
or accepted publication; an uncertain publication reuses its existing mutation
receipt rather than creating a second challenge.

## Verification

Seven public-session cases cover canonical and changed rereads, provider callback
mutation, canonical and changed publication, mutated public run identity, and valid
reward refresh. The complete client race suite passes 543 tests in 46 suites.
Portal types, documentation and source-size gates pass.

Eight injected desktop/mobile browser journeys retain and alter the mounted
session's displayed result before a reread or actual Create challenge button click.
A matching changed result/publication is rejected; actual Retry recovers the
canonical response. The browser verifies the original 60-second finish in state,
no extra gameplay mutations, one accepted publication and one cancelled mock share,
and identical publication request IDs across retry. No browser exceptions occurred.
The 390px publication-retry screenshot was visually inspected. The harness provides
an injected referral capability; no real share or challenge publication occurs.
No visible text or locale keys changed.

`docs/development-tasks/race-private-outcome-isolation.json` declares twenty gates
including full backend coverage, client/core tests, typing, security, isolation,
all seven named platform builds and retained/new browser regressions. Completion
requires an unchanged source digest and current artifact hashes before the local
dashboard can record the task.

This batch does not commit, push, upload, activate or publish Jest, dispatch release
workflows, deploy Functions, or send messages to other chats. Jest activation remains
authorized with publication held; Firebase Functions deployment is separately
authorized. The overall reliability objective remains active.
