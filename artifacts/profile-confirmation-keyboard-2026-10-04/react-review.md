# React and accessibility review

- The committed nested React handler now yields to defaultPrevented, native isComposing and legacy keyCode 229 before cancellation, focus movement or dismissal.
- Reading event.nativeEvent retains browser keyboard metadata without adding component state, refs, timers or document listeners. Unrelated keys return immediately.
- Ordinary Escape still stops propagation and dismisses only the confirmation; ordinary forward/reverse Tab still contains its two enabled controls. Destructive activation is unchanged.
- No public props, callbacks, visible strings, locale keys, provider boundaries or account/economy authority changed. One component changed, without additional renders or SDK dependencies.
- Native canceled keys are verified through a capture listener that prevents default and allows propagation into the actual React handler. IME/legacy metadata are injected DOM keyboard events; they are not a claim of real operating-system composition in a button-only confirmation.
- The actual outer modal, registered Profile, nested confirmation and native focus/return are exercised under StrictMode in both React modes. No substituted component or hook mocks are used.
- Firefox confirmed upload input is excluded from native Tab order. Its scrollable Profile body adds an ordinary native Tab stop, so the initial assumption that exactly two Tabs reach Edit was corrected by observing avatar-to-Edit traversal; no product source was changed for that check.
- No new frame-rate, network-latency or hardware input-latency benchmark is claimed.
