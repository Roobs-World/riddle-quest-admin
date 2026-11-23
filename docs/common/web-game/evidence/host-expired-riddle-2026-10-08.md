# Expired visible-riddle admission

The previous owner-retirement fix left a distinct failure: when the 15-second visible-riddle wait expired before the adapter module loaded, its original delivery signal stayed active. Releasing that module still started the obsolete provider read, although the UI correctly ignored its result.

Every completed visible request now retires its original delivery controller in the existing final cleanup. The normal failure notice and bounded retry run first. This covers ordinary visible reads and the completed-Daily Classic fallback without aborting their shared context. Already admitted provider work retains its original promise and both continuations; this does not claim remote cancellation. Optional silent successor preparation still belongs to its separate context scope.

A real public-factory React browser probe and a focused signal assertion reproduce the original defect. Injecting the original lifecycle into the expanded permanent harness reproduces one failure in each React mode, while the retirement and active-owner controls pass. The final Chromium and Firefox harnesses cover four scenarios, both React modes and three viewports: 48 cases and 288 assertions. Adjacent retirement, coalescing, suspension and warmup probes add 140 cases and 1,356 assertions.

The tests also verify aborted initial and fallback delivery signals, successful automatic recovery, and observation of an original provider rejection after timeout without another response, notice or recovery. All 2,992 portal tests pass (96 skipped), together with types, TSDoc and source-size checks.

All six isolated target artifacts and the Devvit server build pass. YouTube uses the incomplete-content fixture gate and is not certified for partner release. Initial Jest referenced resources measure 576,715 bytes under the unchanged 576,716.8-byte limit, four bytes more than the prior fix. Only 1.8 bytes of startup headroom remain; a measured startup reduction is the next performance task.

The built-game cohort passes 22 Jest/Reddit checks and one fresh Facebook check, with rendered standards evidence.

Evidence lives in `artifacts/host-expired-riddle-2026-10-08/`: 2,480 selected source hashes, three owned input snapshots and reversible diff, original lifecycle and unit reds, final native browser observations/screenshots, unit/static/build logs, preserved built outputs and byte hashes, and rendered standards snapshots. The permanent deferred-riddle probe remains registered in the complete game-browser command.

The overall game improvement goal is unfinished and remains active. No current backend authority certification is inferred from historical evidence. Nothing is published or deployed.
