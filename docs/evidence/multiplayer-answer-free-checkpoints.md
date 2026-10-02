# Private checkpoints for answer-free submissions

`RacePlay.projectGuess` returned before capturing submitted input when the displayed question omitted evaluation data. Pending response validation then read mutable public answer arrays and history. A retained UI reference could change the expected echo, reject genuine feedback, accept a different submitted echo or corrupt rollback/history.

Every valid question now captures its run, submitted letters and accepted history in a private deep clone. A checkpoint records separately whether evaluation-backed rendering permits pending draft edits. Answer-free submissions retain existing input locking and receive no immediate feedback. Confirmation uses privately submitted letters/history; rejected delivery restores the captured answer. Disposal and confirmation clear the checkpoint using existing ownership rules.

Ten public-session tests cover both genuinely answer-free clients and clients which previously confirmed an answer before a compatible omission: genuine feedback after a retained input edit, changed echoes matching the public edit, transport rollback, accepted-history isolation and normal pending input locking. Before the fix, eight regressions failed and two controls passed; all ten now pass. The full client multiplayer suite passes 598 tests in 52 suites, and portal types and documented-declaration checks pass.

The injected browser harness runs 20 journeys across 1280px and 390px. It types/submits through the game, holds the host response, checks that pending keyboard edits remain blocked, edits retained public arrays, then confirms or rejects the response. Changed echo and transport cases recover with the actual Retry button and one submitted mutation; history cases preserve original accepted rows. A mobile transport recovery screenshot was visually inspected. Logs and screenshots are under `artifacts/race-answer-free-checkpoints/`.

The task manifest retains the previous 24 verification gates and adds this browser harness for 25 total, including backend coverage, core/client suites, architectural checks and seven isolated builds. Full validation and dashboard completion recording are pending. Source-digest protection remains unchanged.

Jest activation is authorized but publication remains on hold. Firebase Functions deployment is authorized. This batch changes client submission reconciliation and does not require a Functions deployment.
