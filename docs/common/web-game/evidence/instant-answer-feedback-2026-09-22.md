# Immediate answer feedback — 22 September 2026

## Problem and cause

Submitting a solo answer previously set `guessPending` and waited for the
`submitSinglePlayerGuess` response before colouring letters or presenting a win.
Removing the loading overlay did not remove this network dependency. A reducer
regression reproduced it: both correct and wrong submissions had zero feedback
rows while the server response was outstanding.

## Change

New clients request `includeEvaluation: true` when loading an issued classic or
daily riddle. The backend includes the active answer and its content locale in an
optional `evaluation` field. The UI uses the shared deterministic scoring rules
to colour letters immediately and show the existing win message on a correct
answer. The answer is loaded with the clue, without an extra submission-time fetch.

The original guess request still goes to the backend. Confirmation replaces the
preview; disagreement uses the server result, and failure restores the previous
input and confirmed board. The client retains the retry request ID. Completion
delivery waits for guess confirmation, and rewards, balances, attempts, hints,
continues, and progression remain server-authoritative. A preview is excluded
from saved progress and pending completions. Paid-continue controls wait for
confirmation. Additional guesses remain serialized until confirmation, but players can draft
and edit the next answer while a wrong answer is being confirmed. Guess requests
no longer trigger the host's global interaction blocker. Confirmation preserves
the next draft, and stale saved-state echoes cannot overwrite active feedback.
Evaluation uses the issued session's answer snapshot, including when source
content changes after the session was created.

YouTube, Netflix, and Yahoo share the local authority. It already scored locally;
its input policy now also permits drafting during a pending save. Further material
actions remain serialized, and an uncertain failed save still blocks input until
its exact payload is retried. The aggregate artifact build now uses the strict
YouTube production-content build instead of the fixture build.

Preloading makes the active solo answer inspectable in browser memory. It does
not provide answer secrecy or prevent a player inspecting that answer. Race
requests and competitive scoring were not changed. The evaluation data is not
included in the player-data save.

## Verification

- Before the fix, the two immediate-feedback reducer cases failed with expected
  row count 1 and actual count 0.
- Browser feedback timings with confirmation withheld: Jest **2.4 ms wrong /
  3.2 ms correct**, Facebook **13.2 ms**, Reddit **10.7 ms**. Next-draft editing
  was verified before confirmation, and its contents survived confirmation.
- YouTube feedback rendered in **7.0 ms** during a deliberately delayed five-second
  platform save; typing stayed enabled while submission stayed disabled.
  Netflix and Yahoo local feedback measured **3.0 ms** and **5.3 ms**, respectively;
  wrong and correct answers worked with no external requests.
- These are local Chromium harness measurements, not production device timings.
  Every feedback timing is checked against a 250 ms regression threshold.
- Regression cases were observed failing before the fixes for blocked next-draft
  input, stale restores, issued-answer snapshot mismatches, and local-save input.
- **783 client**, **108 shared-core**, **1,014 backend**, and **31 Devvit** tests passed.
- **44 browser tests** passed across all six targets, including 29 Jest identity
  and lifecycle tests. First-wrong-answer guidance is dismissed through its UI
  before checking next-draft interaction.
- All six isolated production artifacts and audits passed, with strict YouTube
  content validation. The additional GameSnacks candidate aggregate build also
  passed. Devvit packaging passed its isolated-client and gateway contract.
- Type checking, backend build/lint, security, source-size, TSDoc, and diff checks
  passed. Aggregate verification initially stopped on new tutorial-interaction
  test assumptions; after correcting those harness steps, every remaining
  constituent check was run successfully against the built artifacts.

The fast regression command is:

```bash
pnpm --filter @qwordly/portal exec jest --config jest.config.cjs --runInBand src/play/__tests__/gameSession.test.ts -t 'before the server responds'
```

The rendered regression is part of `test:game-browser:playwright`.

## Rollout

No deployment or reviewer resubmission was performed. Deploy the backend and
publish the new client artifacts to enable this behavior for reviewers. Legacy
clients retain the old response shape because the evaluation field is opt-in;
new clients without evaluation data retain server-response feedback as a fallback.
YouTube, Netflix, and Yahoo already score their bundled solo content locally.

Subsequent publication is recorded in [Live deployment — 22 September 2026](../../hosted/evidence/live-deployment-2026-09-22.md).
