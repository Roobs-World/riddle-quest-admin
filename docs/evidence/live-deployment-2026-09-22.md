# Live deployment — 22 September 2026

Production code: ea926de9925bb71ad545d62f0e99109a2f7a8ae4. Release source includes
ff860d8d7e59f874a2235e0a5d92310ee803e0ee, which makes the notification drain test
wait for operation startup before closing the gate. Changes pushed to origin/jest.

## Completed

- Firebase project riddle-quest-ec2b2: getCurrentClassicRiddle,
  getCurrentDailyChallenge, and redditGameplay deployed successfully and
  independently listed ACTIVE. Deployment staged only built server code and
  the validated project configuration; existing Secret Manager bindings retained.
- https://riddle-quest-web.vercel.app: verified all seven files against staged
  output, played ROME, checked 300 → 450 coins and progress after reload.
- https://riddle-quest-pwa.vercel.app: exact-file verification, gameplay,
  persistence, installability, and offline reload passed.
- https://yahoo.roobsworld.com: production deployment
  https://riddle-quest-yahoo-4ugkugm4s.vercel.app; all seven files matched the staged
  candidate. Live gameplay and persisted Classic 2/180 passed with no external
  game requests. This is the provider-neutral hosted candidate, not Yahoo partner
  catalog certification.

## Provider boundaries

- Facebook: prior archive 25102bb69a8d9c43092140ec9916700181faf1a60e03bf00539a237d1878571e
  still has a transmitting receipt. Available browser profiles reach the Meta
  login screen, so its outcome could not be reconciled. No new upload or promotion.
- Reddit: canonical release command refuses missing approved auth, payment,
  refund, post-entry, realtime, and notification fixtures. No Devvit publication.
- YouTube: canonical release handoff passed and produced build-youtube.zip,
  SHA-256 195c6b605b0fa0c94570aeb7f17388cf5f4372db8f4695ab8563d8e151596dfa,
  367,827 bytes, with manifest and test report. Provider portal ingestion and
  certification are still required.
- Netflix: self-contained candidate built and tested; no approved partner
  delivery destination is configured.

## Jest and Firebase Hosting

The canonical Jest release passed the full production gate, the ten-minute
mobile soak, zero-finding W3C validation, and all 30 browser cases against the
exact extracted ZIP. The final dependency fingerprint remained unchanged.

Jest accepted automatic activation of
`1.0.0-dev.20260922151350.ff860d8d7e59.2af4b8b0` at
2026-09-22T15:32:07Z, version ID `01a0c9be-d592-7711-89c4-6f8105715f38`.
Archive: 2,757,539 bytes, SHA-256
`65c5f1572b97c0eb8a3f64222b5deec9127ee225635be6f339c73c680a5ddec7`.

The response is HTTP 202 / processing, not authoritative evidence that the
version is active. The accepted-pending source barrier and receipts remain
intact. No second upload or reviewer resubmission was attempted. Both available
browser profiles required sign-in; a visible Console window was opened and
sign-in requested. The exact-version deployed sandbox check remains pending
Console access and active-version confirmation.

Firebase Hosting received the identical retained ZIP at
https://riddle-quest-ec2b2.web.app. All 418 live files matched the extracted archive byte for byte.
The retained ZIP is under `.firebase/releases/2026-09-22/` (ignored, owner-only).

## Release tooling findings

Two registry connection failures stopped earlier attempts before transmission.
Running the complete pipeline under Node 22 also exposed a test's asynchronous
startup assumption and unsupported Node 24 test-runner flags. The final run used
the normal Node 24 tooling and separately verified Firebase under pinned Node
22.23.1. One complete earlier run stopped when generated dependency inputs
changed after switching runtimes. After preparation stabilized, a per-file
snapshot showed zero changes throughout the successful final release. No gate
was disabled, no failed test was skipped, and no upload barrier was bypassed.
