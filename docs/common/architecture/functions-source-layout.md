# Functions source organisation

Shared authoritative server code stays in `firebase-functions`. Its source folders describe responsibilities inside each feature. Provider-only server integrations stay beneath `platforms/native/<provider>/server` or `platforms/web/<provider>/server`.

## Analysis and layout choice

The review followed production exports, imports, maintenance callers, and test callers before choosing the move map. Race code covered callable boundaries, recorded matchmaking, live play, content, settlement, durable delivery, recovery, and privacy. Keeping those responsibilities in one directory made related files difficult to find. Gameplay also had distinct callable, session, and content-lookup responsibilities.

Two layouts were considered. A mode-first layout would divide recorded and live races, then place their common engine, eligibility, receipts, and privacy code in another shared folder. A responsibility-first layout gives those common implementations one named home and lets both modes use them directly.

The responsibility-first layout preserves canonical implementations. It also leaves room for adjacent production files within the directory limit. Existing daily, profile, presence, social, riddle-supply, infrastructure, and validation folders remain together because they already describe bounded responsibilities.

## Authoritative feature ownership

| Path below `firebase-functions/src` | Responsibility |
| --- | --- |
| `race/api` | Callable entry points and request boundaries |
| `race/access` | Provider scope, account eligibility, and rollout |
| `race/content` | Deck content authoring, validation, import, migration, and translation |
| `race/matchmaking` | Candidate selection, policies, offers, performance priors, read budgets, and bots |
| `race/runs` | Run engine, decks, stored records, command binding, lifecycle, mutations, and response projection |
| `race/invitations` | Recorded invitations, live entry, private join intents, rematches, and challenge creation |
| `race/live` | Live queue, state, scoring, receipts, streaming, retirement, history, and tournament binding |
| `race/notifications` | Shared recipient resolution, consent checks, notification copy, and delivery jobs |
| `race/settlement` | Confirmed outcomes, achievements, idempotent awards, and settlement jobs |
| `race/delivery` | Durable outbox records, retry queues, replay, and referral corroboration |
| `race/recovery` | Deadlines, reconciliation, health inspection, and architecture migration |
| `race/privacy` | Opponent identity projection, deletion handling, and minimized receipts |
| `gameplay/callables` | Authoritative single-player callable boundaries |
| `gameplay/sessions` | Issued sessions, guess transitions, expiry, completion binding, and terminal recovery |
| `gameplay/content` | Riddle lookup and playable fallback selection |
| `daily` | Challenge issuance, generation, progress, streaks, rollover, and scheduling |
| `profile`, `profile/accountDeletion` | Profile updates, username reservations, and global account cleanup |
| `riddles` | Content generation, quality, repositories, supply requests, and workers |
| `presence`, `social` | Shared presence, consent, rival safety, and visibility |
| `shared`, `validation` | Admin initialization, callable policy, telemetry, shared economy/catalog helpers, deletion leases, and server validation |

`raceSetupService.ts`, `raceService.ts`, and `raceReadService.ts` remain at the race root. They implement cross-responsibility orchestration rather than forwarding exports. Gameplay retains its account-data, achievement, and leaderboard implementations at its root.

## Provider boundaries

Facebook owns `server/presence/facebookPresenceFeatureGate.ts` and `server/notifications/facebookLiveChallengePush.ts`. The shared race notification job dispatches through that canonical Meta adapter. Android's account check lives in `platforms/native/android/server/race/androidRaceAccount.ts`. The shared provider-scope codec remains in `race/access/raceProviderScope.ts`, so the native check does not create a runtime import cycle.

Provider receipt verification, purchase grants, referrals, and notification transports stay with their platform integrations. Shared orchestration can call those adapters. The common Play/Jest product catalog and account-deletion leases continue to serve multiple targets despite their historical Jest-prefixed symbols.

## Directory size and tests

Project-owned directories contain at most 20 direct non-test files. The limit counts files directly inside each directory, not all descendants. Installed dependencies and generated or ignored build outputs are excluded.

Tests are exempt from this limit. Existing test and fixture locations remain unchanged, including the central `firebase-functions/src/__tests__` tree. Their imports and mocked module paths follow production moves. Test discovery, emulator setup, and coverage configuration do not determine production folder ownership.

Production source moves with all of its callers. Do not leave old-path re-export shims or duplicate implementations to avoid updating a script, fixture, or audit.

## Runtime and tooling contracts

`firebase-functions/src/index.ts` remains the deployment entry point. Its exported names are deployed API contracts. Firebase still loads `lib/firebase-functions/src/index.js` on Node 22, with CommonJS server emission and the existing regions and capacity settings.

The build recreates the ignored repository-shaped `.build-source` tree, compiles the reachable shared and provider server graph, and audits the resulting archive. Source depth does not change the archive entry. Generated copies are build inputs rather than alternate canonical source locations.

Build preparation and archive checks live in `firebase-functions/scripts/build`. Runtime launchers, content tools, race tools, maintenance, deployment checks, and verification tools have corresponding script folders. Shared backend test configuration lives in `firebase-functions/config/testing`. Root and package commands remain the entry points for routine work.

See the [Functions source reference](../firebase-functions/source-layout.md) for source and tooling entry points, and [platform source ownership](platform-layout.md) for release boundaries. Tests, uploads, and deployments require their existing explicit authorization.
