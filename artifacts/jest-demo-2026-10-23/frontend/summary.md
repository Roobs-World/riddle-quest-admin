# Jest frontend typing audit

No production defect was reproduced, and no application or retained test source changed.

The exact uploaded journal artifact at `artifacts/jest-e2e-2026-10-22/jest-artifact-journal` passed four delivery modes with six consecutive edit/clear laps each, for 24 exact `STA` results at 402×682:

- Playwright physical `keyboard.type("STA", {delay: 0})`.
- Three keydowns in the same JavaScript task, before React commits.
- Three keydowns separated only by microtasks.
- Separate keydown/keyup pairs.

Each lap asserts the visible literal `STA`, deletes all three letters through the virtual keyboard, and asserts an empty answer. Event records include delivered key/data, prevention, composition and target information. No browser errors occurred, and all 419 artifact file hashes are unchanged. Run with `node artifacts/jest-demo-2026-10-23/frontend/verify-keyboard.mjs`; results are in `keyboard-results.json`, with output in `keyboard.log`.

Root separately reproduced the actual hosted native CUA `typeText(null, "PEN")` yielding `P`, while separate `pressKey("e")` and `pressKey("n")` completed `PEN`. Local rapid real keyboard input and same-task batching both retain all letters. This establishes no stale React cursor defect and does not justify a production change for the CUA-specific symptom. Native CUA event instrumentation was not run, so the exact automation delivery mechanism is unproven.

`useAnswerKeyboard.ts` dispatches each admitted letter through the current callback. `GameFrameApp.tsx` dispatches `typeLetter` without capturing the cursor or letters; `gameSession.ts` derives each edit from the reducer's current state. The existing journal readiness and immediate reload repair remain intact.

Repeated onboarding in the local injected mock is explained by `MockJestPlatform.preferences` being an in-memory object that resets on document reload. The real `JestSdkPlatform.writePreferences` writes `onboardingComplete` through SDK `data.set` and awaits `data.flush`; startup reads the stored value. This audit found no concrete production guest onboarding persistence defect and does not claim a fresh real-provider reload test.

No builds, uploads, backend changes, real charges or provider account writes were performed. A prepared local native comparison server was stopped without opening a browser tab after root accepted the 24-case evidence.
