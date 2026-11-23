# Turkish shifted keys and historical hint recovery

The physical answer listener previously ignored Turkish uppercase dotted İ and lowercase dotless ı. A rendered-game reproduction supplied shifted Turkish key events and produced ZMR instead of İZMİR. The listener now admits these two symbols for Turkish content and uses the committed content locale to case them.

Confirmed hints also project an old uppercase I receipt to İ when the current immutable Turkish answer identifies dotted i at the purchased position. Valid dotless-I hints remain I. Without immutable evaluation, the client preserves the received symbol. Receipt identity, coin grants and persisted server receipts are unchanged.

The focused reducer suite passes 86 tests, including dotted, dotless and absent-evaluation recovery cases. The full client suite passes 3,000 tests in 304 suites; 96 tests remain intentionally skipped. TypeScript, TSDoc and file-size audits pass.

The rendered game passes 48 journeys across Chromium and Firefox, development and production React, 390 and 1280 pixel widths, physical typing, virtual keys and shifted-key DOM events, with and without preloaded hints. Each submits İZMİR once and renders five green cells without page errors. Shifted input uses dispatched native DOM KeyboardEvents, not hardware typing. Historical wrong-glyph receipt recovery is verified in the reducer; the browser hint fixtures contain the corrected glyph.

All six isolated targets and the Devvit server build. Exact rebuilt Jest, Reddit and Facebook browser harnesses pass 23 checks. Evidence retains 1,299 built files and their hashes. The only four selected source changes are the keyboard hook, confirmed-hint reducer, reducer tests and browser harness. A final comment-only test documentation correction follows the build freeze and does not enter any target bundle. Backend code is unchanged in this pass; the preceding pass's backend hint casing change still requires its normal server rollout. Nothing is deployed.

Evidence, original failures, source hashes and the reverse-checkable patch are in `artifacts/turkish-key-recovery-2026-10-08/`. The unlimited improvement goal remains active.
