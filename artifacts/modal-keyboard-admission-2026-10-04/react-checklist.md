# React review

- Changes are confined to event admission; passive focus/listener setup and committed callback refs remain unchanged.
- Admission rejects already-consumed events, native composing flags, legacy composing keyCode 229, inert ancestors, and detached dialog DOM before calling preventDefault, focus, or Close.
- Both real components run in StrictMode under development and production React. Removal during a parent layout callback exercises the passive-cleanup window.
- Ordinary Tab/reverse Tab, fresh Escape, and native username submission still work. Compiled profile confirmations and blocked surfaces retain focus ownership.
- No new hooks, renders, public props, visible copy, provider SDKs, or network operations are introduced. All six artifacts pass dependency/content audits.
- Composition checks inject browser KeyboardEvent metadata; they do not claim testing an operating-system IME. Native consumed Escape/Tab and form submission are independently verified in Firefox.
