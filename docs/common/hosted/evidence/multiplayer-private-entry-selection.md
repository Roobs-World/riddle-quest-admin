# Private accepted-entry selection

Four regressions showed that retained UI snapshots could change the resume pointer, erase or rewrite entry facts used by the preceding resume validator, or retarget the expected challenge for an entry response. All four failed before this change.

Accepted entry facts are now copied before publishing a snapshot and retained privately for that snapshot's lifetime. Unrelated presentation updates carry the same private selection; explicit entry replacement/reset creates or clears it. A WeakMap keeps that ownership separate from mutable UI fields and allows discarded snapshots to be collected. Automatic resume exposes only the accepted run-ID primitive; run validation reads the private challenge ID, role expectation and category.

Entry/challenge response selection is now bound to the original private request. Existing requested-run and start role/category checks were extracted into a focused helper without changing their conditions. Independent creator cold resume and valid existing-attempt recovery remain supported. No visible copy was added.

The full client suite passes 1,703 tests across 198 suites, with 102 tests and 13 suites skipped. Ten injected-browser cases cover pointer rewriting before dispatch, erased or rewritten entry facts before resume completion, changed public challenge selection before the entry response, and valid recovery at desktop/mobile widths. Seventy retained browser cases pass for the preceding pointer validator, startup, rendered-entry and command ownership flows.

Portal types, all seven isolated builds, exact dependency evidence, security and scalability pass. The initial extracted guard signature omitted nullable run patches; its failed type/build logs are retained, and the signature correction passes the repeated checks. Global documentation and file-size failures remain in concurrent files outside this focused change. The captured backend-file recheck is recorded separately and does not claim whole-source completion.

Evidence is held in `artifacts/race-private-entry-selection/verification-held.json`. The manifest retains previous gates and adds private entry selection, for 68 checks. No hosted Jest update, publication or Firebase deployment occurred. Dashboard recording and the broader reliability audit remain pending.
