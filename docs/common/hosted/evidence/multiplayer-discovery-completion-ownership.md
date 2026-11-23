# Discovery completion ownership

The public session reproduced three failures before the fix: a recovery adapter synchronously replacing the authenticated account during matched, empty and retryable-failure completion caused the original discovery to install its challenge or error into the replacement lobby. The cancelled case already passed and remains a regression check.

RaceSession now checks the discovery generation after completion recovery writes, cancellation cleanup and play disposal. Failure projection captures its lifetime before persistence and stops if that lifetime changes. Provider discovery and server authority contracts are unchanged.

Four public-session cases verify the replacement retains category discovery, no stale challenge/error, idle matchmaking and exactly its own delivery timer. The complete client race suite passes 450 tests across 31 suites. The injected browser harness repeats all four session probes at desktop and mobile sizes, then renders the real multiplayer UI and verifies ordinary account replacement, category selection and gameplay with denied Web Storage. The session probes exercise custom synchronous callbacks; they do not claim that React exposes those callbacks directly.

The development task runs the full backend, core and client checks, seven isolated platform builds, dependency audits and browser verification before recording completion. Jest activation is authorized; publication and review remain held. Firebase Functions deployment is authorized but this verification performs no deployment.
