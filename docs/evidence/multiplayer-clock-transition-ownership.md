# Clock transition ownership

Invitation expiry reproduced a failure through the public session interface: recovery cleanup synchronously replaced the authenticated account, then the old clock tick installed its expired invitation into the replacement category lobby. A separate result-screen account replacement already passed and remains a regression check. The initial creator fixture did not reach a competitive deadline; the test was corrected to a challenger with a recorded opponent before assessing that behavior.

RaceSession.tick now captures its authenticated lifetime and stops after state notifications, terminal reconciliation and expiry recovery cleanup if that lifetime changes. Existing invitation timing, visible polling and gameplay clocks remain unchanged.

The full rerun exposed an existing timing-sensitive corruption fixture: a fixed 1 ms finish could equal the fake authority result. That case now adds 1 ms to the actual outcome, guaranteeing a contradictory result without changing production acceptance.

The complete client race suite passes 452 tests across 32 suites. The injected browser harness exercises invitation expiry with a custom recovery callback at desktop and mobile sizes, checking the replacement category request, clean entry state and exactly one delivery timer. It also renders the real multiplayer UI and verifies ordinary account replacement followed by gameplay with denied browser storage. The custom callback is tested through the public session; it is not claimed to be a React UI control.

The task runs full backend, core and client checks, seven isolated builds, target dependency audits and browser verification before recording completion. Jest activation is authorized, publication and review remain held, and Firebase Functions deployment is authorized. This verification performs no external deployment.
