# Coin economy verification — 2 October 2026

The balance policy and shop purchasing-power table are in [game-economy.md](../game-economy.md). Verification logs and mobile/desktop shop screenshots are in `artifacts/coin-economy/`.

## Passing checks

- All six production target builds and their artifact isolation audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo.
- Reddit Devvit package contract, built from the new Reddit client artifact.
- Core suite: 31 suites / 282 tests.
- Focused backend economy, authoring and authority suites: 9 suites / 156 tests. These cover Classic and Daily difficulty grants, receipt replay, rejection of client difficulty, private session difficulty immutability, preservation of reviewed authoring metadata, and coin-funded actions.
- Focused client economy, shop and local authority suites: 4 suites / 38 tests.
- Injected Jest browser harness: 12 tests, including shop buying power at 390px and 1280px, displayed hint/skip costs, charged skips and queued coin-action recovery.
- Injected YouTube SDK browser harness: 10 tests, covering successful Save gating and local play recovery.
- Netflix and Yahoo browser checks: 2 tests, including local completion and absence of paid shops or external requests.
- Client, backend and Reddit type checks; backend build and module-cycle audit; lint on changed backend production files; file-size audit; all 16 locales' keys and placeholders.

## Broader workspace limitations

The failures below record the original economy checkpoint. The subsequent [multiplayer browser repair](multiplayer-browser-failure-repair-2026-10-02.md) passes both provider walkthroughs and the full client/backend unit suites; the TSDoc limitation remains.

Other work was changing this shared checkout during verification. Initial builds encountered an unfinished profile stylesheet; builds passed after that file and its translations appeared.

The latest full client run failed on expectations for a newly added `getLiveRaceChallenge` callable. The latest full backend run failed in `classicRiddleBufferLatency.test.ts` because its mocked public session response omitted required attempt/continuation status fields. These failures are outside the economy assertions; the focused economy suites passed afterward.

The complete Facebook and Reddit walkthroughs reached their multiplayer hub checks and then failed because they expected `.race-hub-tabs` from the previous hub UI. The current hub rendered category-selection controls. The shop/action verification uses the passing injected Jest harness and the shared commerce UI; the complete provider walkthroughs are not reported as passing.

The global TSDoc audit still reports undocumented declarations from concurrent work. It reports no outstanding declarations in the new economy module or this task's added tests. No unrelated changes were reverted to make these broader checks pass.

The changes are local and have not been deployed. Client and backend economy changes should ship together to keep displayed and charged prices aligned.
