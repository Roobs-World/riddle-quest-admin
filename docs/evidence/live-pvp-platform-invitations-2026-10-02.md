# Live PvP platform invitations — 2026-10-02

Players can choose **Challenge a friend** on the multiplayer category screen to reserve a private live lobby, then use the lobby's challenge button to open the current platform's native sharing dialog. Jest uses `referrals.shareReferralLink` through `JestPlatformPort.shareReferral`, including the host's SMS share option. Facebook uses the existing age- and feature-gated `shareAsync` adapter with `intent: "CHALLENGE"`. Both carry an opaque `live_<ticket-id>` challenge handle through SDK entry data. No browser recipient identity, score, answer, entitlement or delivery acknowledgement is trusted.

The recipient sees a server-validated, accessible incoming-challenge notice on the initial multiplayer screen. **Accept challenge** joins the original creator's lobby, copies its immutable language/category/deck and starts the existing shared five-second countdown. Previewing does not join. Atomic acceptance permits one recipient; retries and a fresh request after a lost response recover the same seat and countdown.

Private lobbies expire after 15 minutes. They never enter the public queue and never select a bot. The sender must still be present or reconnecting; an acceptance more than 30 seconds after its last heartbeat can retry when the sender resumes. Expired unattended pointers cannot block a new search or acceptance. Server checks enforce authenticated provider boundaries, account deletion, reciprocal blocks, self-invitation rejection and active-seat ownership. Existing live scoring and reward settlement remain authoritative.

## Notification delivery boundary

The follow-up [offline push implementation](live-pvp-offline-push-2026-10-02.md) adds server-addressed invitations, a durable multiplayer inbox, Meta server notification delivery and optional self-managed Jest browser push. Its configuration, deployment and real-host verification remain separate from the earlier native invitation work described below.

The native invitation/message is the external challenge notice. On launch, the game announces the incoming challenge and exposes acceptance without automatically joining. This change does **not** implement a separate unsolicited push to an arbitrary offline recipient. Jest's browser notification API schedules messages for the current registered player, with platform-controlled delivery; it does not identify another recipient or acknowledge immediate delivery. Facebook's existing notification adapter supplies bot-subscription consent, while separate server bot delivery is still unavailable. Do not treat a completed share dialog as proof that a notification was delivered.

References: [Jest referrals](https://docs.jest.com/sdk/referrals?engine=html5), [Jest notifications](https://docs.jest.com/sdk/notifications).

## Verification

- Real Firestore emulator transaction tests: invitation preview, concurrent acceptance, original lobby identity, stable countdown recovery, public/bot isolation, provider/self/block/expiry/cancellation/presence rejection, conflicting active seats and expired-pointer recovery.
- Injected browser harness runs the actual Jest sharing hook, Facebook sharing adapter and shared React UI against the compiled server authority. Both targets pass at 390×844 and 1280×900: native payload, dismissal/failure retries, incoming notice, no auto-acceptance, original lobby acceptance and shared gameplay.
- Existing public PvP browser regression passes at both widths, including normal search, bot fallback, countdown, progress, hint/skip behavior, rewards and return navigation.
- Targeted client adapter/UI tests and core input-authority tests pass; portal/functions types, locale parity, file-size and backend scalability checks pass.
- Production builds and artifact audits pass for Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Solo artifacts remain isolated; Reddit remains same-origin.
- A combined rerun of the concurrently edited general live-race suite also reported a French-catalog fixture missing required translation metadata. The new invitation suite passed independently; the real-server public browser regression passed.
- Repository-wide TSDoc audit reports unrelated existing/concurrent declarations. No invitation implementation declarations appear in its failure list.

Logs and screenshots: `artifacts/live-pvp-invitations/`.

Reproduce the invitation harness after building core/functions:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8199 GCLOUD_PROJECT=demo-live-invitation-browser pnpm --filter @qwordly/portal test:race:live:invitations:browser
```

The demo emulator must already be running. These tests inject SDK boundaries and contact no production service or real recipients. Production activation requires deploying `getLiveRaceChallenge` and the updated live callables, then verifying invitations with two platform sandbox users in the real native dialogs. Existing Facebook referrals/age gates still apply; no new SDK permission or notification-console setting is claimed.
