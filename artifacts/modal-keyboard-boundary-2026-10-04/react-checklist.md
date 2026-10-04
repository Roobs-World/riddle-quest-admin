# React review

- Native keyboard policy uses one committed snapshot of callback, modal kind, guess readiness, continuation readiness, and interaction ownership. Suspended renders do not publish replacement policies.
- Registration/retirement runs in layout effects; normal modal registration depends only on active modal/interaction ownership. Recovery registers once per component lifetime. Cleanup revokes callback ownership before removing the listener.
- Scroll, deferred focus setup, focus return, external notice masking, and fanfare state updates retain their passive timing. Focusable controls use a shared private helper with the previous nested-confirmation selector.
- Native handlers read current modal DOM and return early for unrelated keys. Canceled/composing/inert/detached guards and mandatory coin/Continue/victory policy are retained.
- Actual components run in StrictMode under both React modes; parent layout callbacks test activation, commit locks, unlocks, blocking and retirement. Existing suspended-render, consumed-key, full recovery, focus and compiled confirmation checks pass.
- Thirty-two pending-lock updates cause zero listener adds/removes, compared with thirty-two of each before the change. This measures registration work, not hardware input latency or frame rate.
- No visible text, public props, provider contracts, network calls, or authority behavior changes. Six isolated target audits pass; YouTube uses fixture content.
