# React review

- Both native Escape refs publish in layout effects with complete callback/lock dependencies. Suspended renders leave committed handlers intact.
- No state update or extra render is introduced by the change. Existing native keyboard listeners remain stable across callback changes and 32 ordinary parent renders.
- Existing passive focus setup, focus return, inert priority, mandatory completion and paid-action logic remain in place. Native Close continues to use committed JSX callbacks.
- Actual components run under StrictMode in development and production, at three viewport sizes. Full game recovery and focus-chain journeys exercise the parent call sites.
- No public prop changes, visible copy changes, provider APIs, or target dependencies were added. All six isolated artifacts pass their audits.
- Evidence covers suspended and abandoned renders. It does not claim new network latency or hardware performance measurements.
