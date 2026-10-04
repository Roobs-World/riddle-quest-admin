# React and accessibility review

- Scroll reset now has its own passive effect with modal-page identity as the sole dependency. Same-page readiness, rewards and blocking changes retain the reader's position. Initial/page-switch reset still precedes deferred focus.
- Deferred focus, notice masking and cancellation retain their existing lifecycle dependencies. Committed keyboard policy and lock publication remain unchanged.
- A remembered control still must belong to the current enabled modal/confirmation scope. Restoring it uses preventScroll; initial fallback focus retains ordinary browser behavior.
- Actual focus capture remains private transient ref state, cleared on committed close. No state update, new document subscription, provider call or layout measurement was added.
- One component changed; no visible text, public props, locale keys or SDK dependencies changed.
- Actual page CSS determines the scrolling surface: Profile and Instructions have inner scrollers; Settings and Credits scroll the shell. The harness uses native wheel/navigation, actual components, and observed DOM scroll positions. Its scrollTo wrapper counts calls and forwards the native implementation; it does not replace component hooks or scrolling behavior.
- The measured improvement is 64 explicit native scroll-reset calls to zero over 32 readiness updates, plus retained reading position. It is not a frame-rate, network-latency or hardware benchmark.
