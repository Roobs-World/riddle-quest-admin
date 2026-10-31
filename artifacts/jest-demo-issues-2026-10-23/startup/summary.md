A healthy cold purchase-recovery request could fail the entire Jest startup because its preflight took 16.456 seconds while the client aborted after 15 seconds. The actual hosted evidence is retained in docs/evidence/jest-hosted-resume-2026-10-23.md. The client now waits at most 30 seconds for its existing signed HTTP operations. No retries, grants, provider completion policy, SDK initialization, heartbeat, or server configuration changed.

The production change is the existing JEST_BACKEND_REQUEST_TIMEOUT_MS constant in packages/portal/src/jest/backend.ts, from 15_000 to 30_000. It applies to identity exchange, deletion recovery, purchase grants, referral verification, and entitlement sync. Explicit per-client timeout overrides still apply. HTTP errors still reject immediately. An unavailable backend can now take 30 seconds to show Retry; it remains bounded and aborts the request even if fetch ignores its signal.

The feedback loop calls the actual startJestSession, JestPurchaseCoordinator and JestBackendClient. Only the external provider/fetch boundary is simulated. It delays CORS completion before dispatching the signed purchase POST. The original default produced the exact retryable startup failure in 0.246 seconds of test runtime. Supplying the existing 30-second constructor option made that same loop pass without production changes, ruling out the SDK init, loading heartbeat and recovery ordering as necessary causes.

The repository regression ran red before the constant change (four failures) and green after it (four passes). It covers the observed 16.456-second delay and a 27-second delay, 30-second bounded failure, and a rejected authoritative response after successful cold preflight. Progress updates occur every ten seconds with gaps below the SDK's 15-second watchdog. The tests assert no early markGameLoaded or Firebase authentication, one SDK init, grant before provider completion before identity, exactly one token acknowledgement, no automatic retries, retained pending purchase on failure, and timer/signal cleanup.

Validation completed:

- Four affected suites initially passed 92 tests: startupColdRecovery, backend, startup and purchases. The shared transport checks all five signed operation deadlines, a fetch implementation ignoring abort, HTTP 400/503 cleanup and the existing explicit short-deadline override.
- Direct production TypeScript and focused regression TypeScript checks pass. The focused test configuration includes Node timer types because Jest runs in Node.
- The complete TSDoc audit passes, with 28,861 declarations across 1,257 files documented.
- The existing browser recovery script changes only its held-HTTP clock from 15.1 to 30.1 seconds. SDK read/completion clocks remain 15.1 seconds. The combined browser gate passed ten journeys at 390px and 1280px against frozen runtime hashes, including empty-queue startup, HTTP timeout/rejection with explicit Retry, stalled SDK reads and stalled provider completion. It preserved the original token and one durable grant, and reported no unexpected page, console or network errors. Supporting source-fixture browser evidence is separate from root's exact hosted artifact acceptance. Results and screenshots are in browser-recovery/.

After the separate acknowledgement repair froze, the same four affected suites passed 95 tests on combined source. The final log is combined-affected-unit-suites.log.

Affected files:

- packages/portal/src/jest/backend.ts
- packages/portal/src/jest/__tests__/backend.test.ts
- packages/portal/src/jest/__tests__/startupColdRecovery.test.ts (new)
- packages/portal/scripts/verify-jest-purchase-recovery-browser.mjs

No canonical target build, upload, deployment, provider request, runtime configuration, billing or capacity change was performed for this repair. Root owns final artifact verification and upload. A separate post-grant provider-completion issue is owned by the other agents and is not claimed fixed by the startup deadline.

Evidence commands and raw results are retained in cold-preflight-before.log, cold-preflight-option-probe.log, cold-recovery-regression-before.log, cold-recovery-regression-after.log, affected-unit-suites.log, production-typecheck.log, focused-test-typecheck.log and tsdoc-audit.log. startup-deadline.patch and source-sha256.json identify the reviewed change.

Reproduce the focused final unit gate:

```sh
pnpm --dir packages/portal exec jest --runInBand --runTestsByPath src/jest/__tests__/startupColdRecovery.test.ts src/jest/__tests__/backend.test.ts src/jest/__tests__/startup.test.ts src/jest/__tests__/purchases.test.ts
```
