# Multiplayer provider record recovery

A completion effect attempted each optional standings record only once. Although a rejected write released its duplicate guard, normal standings refresh did not retry that run. The tournament and Activity screens could therefore remain missing a completed race until reload. A synchronous resume could also finish before the provider lifetime was installed.

`RaceProviderViews` retains failed writes by destination and retries only those belonging to the visible provider view. Pending and successful writes retain their duplicate guards. A successful write invalidates its corresponding cache and replaces a visible read started before the write committed. Old reads cannot overwrite the new standings. Account replacement and disposal remove queued retries; a confirmed context change discards old context retries and invalidates their callbacks so an old run cannot be redirected into another room.

`RaceTo10Game` catches up a confirmed outcome when provider ownership is installed. Its normal completion effect and catch-up use the same per-adapter guard. No race settlement, purchase, challenge publication, or scoring command is repeated for standings recovery. No visible text or provider SDK dependency was added.

## Evidence

- Before implementation, two public-interface recovery tests failed; 21 existing/control tests passed (`artifacts/race-provider-record-recovery/before.log`).
- After implementation, all 27 provider-view tests passed, covering both destinations, pending-write coalescing, stale pre-write reads, synchronous failures, independent adapters, account replacement, context changes, and failed optional presentation notifications (`after.log`).
- Injected React browser verification exercises immediate resumed completion, a rejected record, real tournament/Activity tab selection, a held retry, a stale list reply followed by a fresh reply, and revisiting the view without a third write. Desktop and mobile screenshots and logs live in the same artifact directory. The harness navigates to the hub through the public session seam, then uses rendered tabs.
- The development completion manifest includes all retained multiplayer checks, the full backend race suite, and all seven isolated target builds. Its generated receipt and automatic dashboard ledger are authoritative for completion against the verified source digest.

This client change requires an active draft build for hosted Jest testing. Jest publication remains on hold. Firebase Functions deployment is authorized, but this batch changes no backend runtime behavior and does not deploy it. The broader multiplayer reliability audit remains active.
