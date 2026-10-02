# Confirmed answer evidence for omitted reveal payloads

The snapshot validator used the current response's evaluation or retained complete deck to check revealed letters. A client which only received the current question's answer lost that validation when a compatible later response omitted evaluation. An internally consistent but wrong hint could then lock the wrong letter into the player's answer.

`raceSnapshot` now falls back to the private previous question's evaluation only when the current question has the same deck position. Existing immutable-question checks establish content identity before this fallback. Newly revealed letters remain constrained by the known answer even when the incoming response omits it. A different question does not inherit the old answer, and genuinely unknown legacy answers remain compatible.

Eight public-session tests cover corrupted hint and resume responses, matching public evaluation edits, canonical hint and resume omissions, an answer-free successor with a different letter, and genuinely unknown legacy reveal compatibility. Before the fix, the four negative cases failed while all four controls passed; all eight pass afterward. Logs are under `artifacts/race-known-answer-reveals/`.

The injected browser harness runs 16 journeys at 1280px and 390px. It types draft letters through the rendered game, invokes the actual Hint button for paid confirmations, and recovers invalid receipts through the actual Retry button. It proves one hint mutation without replay, canonical revealed letters, retention of unrevealed draft input, successor isolation and legacy compatibility. The mobile hint recovery screenshot was visually inspected.

The full multiplayer client suite passes 588 tests in 51 suites. Portal types and documented-declaration checks pass; missing test declarations were documented before full verification. The task manifest retains the prior 23 verification gates and adds this browser harness for 24 total, including backend coverage and seven isolated builds. Full verification and dashboard completion recording are pending. The source-digest guard remains unchanged.

Jest build activation is authorized but game publication remains on hold. Firebase Functions deployment is authorized. This change affects client validation and does not require a Functions deployment.
