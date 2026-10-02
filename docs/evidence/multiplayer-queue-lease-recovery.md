# Multiplayer delivery queue lease recovery

The settlement/performance queue deferred processing whenever a finite future lease deadline existed, even if the retained checkpoint had no worker identity. A cleared or malformed owner could therefore block pending delivery without any worker able to release the checkpoint. Unsafe and fractional deadline values also qualified as active leases.

The queue now respects a lease only when it has a nonempty bounded worker identity and a safe integer future deadline. Ownerless or malformed lease state permits a fresh worker to acquire the checkpoint and process pending receipts. Invalid invocation clocks, including arithmetic overflow when adding the lease duration, are rejected before any checkpoint mutation. Valid-worker exclusion, lease expiry recovery, cursor rotation, per-receipt retry and stale-worker checkpoint protection remain in place. No purchase grant, result, reward amount or provider contract changes.

## Evidence

- `artifacts/race-queue-lease/unit-before.log`: six new Firestore integration cases reproduced blocked processing with missing, cleared, nonstring or empty worker identity, unsafe deadlines and fractional deadlines. The previous 21 queue/health cases passed.
- `backend-race.log`: all 1,048 backend race cases across 72 suites pass, including the six lease repairs and four invalid invocation clocks. Coverage is 93.48% statements, 89.57% branches, 96.97% functions and 95.79% lines, above every required threshold.
- Node 22 backend build/operator safeguards, backend types and lint pass. Source size, TSDoc, security, scalability and all seven isolated browser-target builds and artifact/dependency verification pass.
- The runtime is staged from the validated compiled files and vendored core package; staged bytes are checked against the built checkout. The project-specific environment file is retained, while checkout environment files are unchanged. Only `settleRaceDeadlines`, the sole deployed caller of both queue processors, is selected for deployment. Deployment succeeded: `settleRaceDeadlines` is ACTIVE on Node 22, and the new `settleracedeadlines-00015-kul` Cloud Run revision receives 100% of traffic. Filtered function/service metadata and `deployment-verified.json` record the verification.

`docs/development-tasks/race-queue-lease.json` retains all 35 full-source gates. Automatic dashboard completion remains pending while the authorized hosted pathway chat edits evidence; focused backend verification and deployment evidence do not replace the stable full-source completion receipt. The pinned active Jest draft is unchanged and unpublished. The multiplayer reliability audit remains active.
