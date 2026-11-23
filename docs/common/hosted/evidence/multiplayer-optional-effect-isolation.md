# Multiplayer optional effect isolation

30 September 2026; working-source changes based on `c34be571`.

Race Session now isolates synchronous throws and rejected promises from its
optional effect adapter. An accepted authority receipt keeps its committed
competitive state, outcome and publication even when telemetry or provider
delivery fails. Each later effect is still attempted. Duplicate receipt handling
continues to prevent replay of completion and publication effects. Closing
disposes the journey before invoking its rendering adapter.

`RaceProviderViews.record` owns separate delivery guards for tournament and
context adapters. A synchronous failure in one adapter cannot suppress the
other. Failed deliveries release only their exact guard; a late old account
failure cannot remove a newer account's guard for the same run identifier.
Successful or pending delivery stays coalesced. Account replacement during a
native callback stops the remaining old account adapters. This adds no automatic
write replay or delivery deadline; authoritative settlement and durable delivery
continue to belong to the backend.

The React adapter also isolates analytics issued directly before sharing and
rematching, so telemetry cannot prevent those player actions. No new visible
text, translations or provider SDKs are added.

Public-interface tests cover both synchronous and asynchronous failures, accepted
completion/publication, duplicate receipts, paid hint/skip confirmation, closing,
independent provider delivery, explicit retry, old account rejection, disposal and
reentrant account replacement. Injected browser checks make analytics transport
throw during race start, terminal hint and completion, and before three repeated
shares in the full creator-publication/recipient journey.

The verification task below records stable-source evidence into the existing
local dashboard only after its checks pass:

```sh
pnpm development:complete docs/common/development/development-tasks/race-optional-effect-isolation.json
```

This is partial evidence for the continuing multiplayer reliability audit.
Repository-wide TSDoc findings in concurrent changes remain a separate gate.
