# Multiplayer push updates — 2 October 2026

## Result and release status

Opponent changes now trigger an immediate authoritative refresh in the Jest and Facebook clients. A healthy foreground human race no longer waits for the 500 ms polling timer. The backend support was deployed successfully to `riddle-quest-ec2b2` in US and Europe. The client builds are verified, but were **not uploaded or activated** in this work session; existing deployed clients continue polling until the normal client release.

Reddit retains its same-origin `/api/*` transport and 500 ms foreground polling. YouTube, Netflix and Yahoo remain self-contained and do not gain multiplayer or Firebase dependencies.

## Implementation

Live race mutations atomically write an opaque revision marker under `liveRaceSignals/{ticketId}` for each affected participant. Pairing, private invitation acceptance, opponent progress and relevant account deletion changes all wake the observer. Unchanged polls and duplicate commands do not write new revisions. Markers contain only a UUID revision and an expiry timestamp; no answers, scores, identity or economy data are exposed. Direct browser access to the collection remains denied.

The existing `updateLiveRace` Firebase callable supports a read-only authenticated streaming request using the existing Functions SDK. It verifies ticket ownership, rollout access, expiry and account deletion state before listening. Streaming requests cannot submit guesses, spend currency or mutate race state. Normal commands retain their existing authority, idempotency and account deletion guards.

Streams run for at most 45 seconds, emit heartbeats and renew with fresh requests. The client deduplicates revisions, reconnects with bounded backoff, cancels retired subscriptions and resumes fast polling on stream failure or silence. A connected foreground race retains a five-second reconciliation watchdog. Lobby, bot and background observations retain their existing cadence; completed-player penalty windows use fast reconciliation so settlement deadlines remain observable.

Notifications received while another request is in flight are coalesced and replayed when that request releases the delivery lock. Player commands still supersede stale polls, and answer drafts survive incoming opponent updates. No visible text or locale keys were added.

## Measured verification

The injected browser harness uses the production observer and real Firebase Functions SDK streaming parser, a local HTTP stream, and the actual backend authority against a Firestore emulator. These are local timing samples, **not production latency measurements**.

| Check | Desktop, 1280 px | Mobile, 390 px |
| --- | ---: | ---: |
| Poll requests during a healthy 3.25-second foreground window | 0 | 0 |
| Opponent action to displayed update | 113 ms | 98 ms |
| Authority receipt to displayed update | 35 ms | 20 ms |

The harness also verifies a real push notification arriving while a stale poll is held open, the queued immediate refresh after its release, preserved typing, fallback polling after stream failure, countdown answer withholding, hints and skips, penalty-aware settlement, exactly one 50-coin winner grant, bot fallback and missing-capability navigation. Machine-readable samples and screenshots are in `artifacts/live-race-push/merged-browser/`.

The merged checkout passed:

- 2,235 client unit tests across 264 suites. The unit configuration skipped 116 tests in 15 optional browser suites; the dedicated injected browser harness ran separately.
- 1,574 backend unit tests across 128 suites, backend lint and TypeScript build.
- 63 emulator integration tests across four suites, including streaming trust boundaries, revision stability, deletion cleanup and private collection access denial.
- Desktop and mobile injected multiplayer browser journeys.
- All six required isolated target builds and their provider-boundary audits, plus GameSnacks. All 16 locale checks passed.
- TSDoc audit: 22,619 declarations across 1,046 files.

The unrelated file-size release audit still failed at `packages/portal/src/jest/__tests__/authentication.jest-playwright.test.ts`: 1,202 equivalent lines against a 1,200-line limit. The shared checkout also contains uncommitted concurrent work. The normal Jest release requires committed, clean source and the production gate; it was not bypassed. This report does not claim the shared checkout is release-ready.

## Deployment and cost

Firebase deployment completed with the following active revisions:

| Function | Region | Active revision | Minimum instances |
| --- | --- | --- | ---: |
| `joinLiveRace` | US (`us-central1`) | `joinliverace-00007-lof` | 1 |
| `joinLiveRace` | Europe (`europe-west1`) | `joinliverace-00007-vus` | 1 |
| `updateLiveRace` | US (`us-central1`) | `updateliverace-00007-zeh` | 1 |
| `updateLiveRace` | Europe (`europe-west1`) | `updateliverace-00007-sif` | 1 |
| `deleteAccount` | US (`us-central1`) | `deleteaccount-00038-pet` | 0 |

Join/update retain their existing 256 MiB memory, 60-second timeout, 80-request concurrency and one minimum instance per region. The declined additional solo warming was not deployed. Streaming changes usage costs through request duration and Firestore listeners; no additional fixed idle reservation was introduced, and no usage-cost reduction is claimed.

Firestore TTL for `liveRaceSignals.expiresAt` was enabled and verified `ACTIVE`. Account deletion removes owned markers and wakes surviving participants. The observer closes on profile removal or a deletion tombstone without holding a long mutation lease.

Deployment evidence is saved in `artifacts/live-race-push/deployment-receipt.json` and `artifacts/live-race-push/logs/backend-deploy.log`. Full test/build logs are in the same logs directory. Authenticated production opponent-display latency remains to be measured after client activation.
