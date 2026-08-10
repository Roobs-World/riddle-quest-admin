# Backend scale readiness

This document records the application-level guarantees and the production work required before claiming readiness for millions of users. Capacity must be demonstrated with staged load tests; architecture alone is not a capacity result.

## Guarantees in the repository

- Daily challenge rollover is lazy and date-derived. The scheduler writes the challenge documents only; it never scans or updates every user.
- Authenticated daily challenge reads fetch the player document once per request.
- Riddle supply checks read only the highest indexed riddle. Replenishment uses a stable locale/index claim so concurrent players cannot trigger duplicate generation.
- Purchase grants, identity exchange, and referral rewards remain server-authoritative and idempotent through stable document keys and transactions.
- Race data uses expiring documents with Firestore TTL configuration.
- Callable functions enforce App Check outside the emulator.
- Unqueried sequential timestamps and large user maps/arrays are exempt from automatic indexing to reduce write fanout and storage.
- `pnpm check:scalability` guards the daily path and required index exemptions during CI builds.

## Production prerequisites

1. Use a Firestore location close to users and compute. Prefer a multi-region location when the availability and cost tradeoff fits the product; database location is an early architectural decision.
2. Enable billing budgets, quota alerts, point-in-time recovery or scheduled backups, and separate development, staging, and production projects.
3. Put the public Jest HTTP endpoints behind a distributed edge rate limit or WAF. The in-process limiter is only a per-instance safety net and cannot enforce a global quota.
4. Define SLOs and alerts for p50/p95/p99 latency, error rate, cold starts, function instance saturation, Firestore contention, reads/writes per request, and cost per active user.
5. Request quota reviews before launch peaks. Set function maximum instances only from measured downstream capacity; avoid a limit that merely moves overload into Firestore or third-party APIs.
6. Test idempotency under retries and duplicate delivery for purchases, referrals, registration, and challenge completion.
7. Roll traffic up gradually. Start near 500 operations per second for a new key range, then increase by at most 50% every five minutes while the SLOs remain healthy.

## Load-test gates

Run tests against an isolated production-like Firebase project with synthetic accounts and no real purchases.

| Gate        | Workload                                            | Pass criteria                                      |
| ----------- | --------------------------------------------------- | -------------------------------------------------- |
| Baseline    | Typical login, challenge, leaderboard, and race mix | Stable p95/p99 latency and no correctness failures |
| Retry storm | Duplicate requests and forced client retries        | Exactly-once grants/rewards and bounded contention |
| Hot event   | Concentrated daily reset and leaderboard traffic    | No collection scan, hotspot, or cascading timeout  |
| Soak        | Sustained expected peak for several hours           | No memory growth, quota drift, or cost surprise    |
| Step-up     | Gradual 500/50/5 traffic ramp beyond forecast peak  | SLOs hold with documented headroom                 |

Record the dataset shape, request mix, regional origin, function concurrency, observed quota use, latency percentiles, error taxonomy, and estimated monthly cost with every result.
