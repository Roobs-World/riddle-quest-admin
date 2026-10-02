# Offline PvP challenge notifications — 2026-10-02

The private lobby now supports a direct invitation to an existing game username. The server resolves the normalized username reservation, requires the same platform, checks both accounts and reciprocal blocks, binds acceptance to that recipient, and atomically writes the recipient's inbox entry and one durable notification event. Retrying the send recovers the same event. Native Facebook friend sharing and Jest SMS invitations remain available for people whose game username is unknown.

The initial multiplayer screen reads pending direct invitations, including invitations received while the browser was closed. Reading never joins a lobby. Explicit acceptance joins the original creator's lobby with its original language, category and immutable deck.

## Delivery

- Facebook uses the documented `POST https://graph.fb.gg/{app_id}/notifications` API with a server-only app token, canonical provider identity/generation, and the existing consent/capacity ledger. Payload contains only the opaque challenge handle. The provider's public documentation does not specify the acknowledgement body, so responses are conservatively recorded as **unconfirmed**, never as delivered. Uncertain ledger slots remain reserved; no automatic retry or capacity reset guesses provider state.
- Jest uses our own Firebase Cloud Messaging browser subscription rather than an undocumented Jest server API. Only an authenticated registered Jest player can enable it. Permission is explicitly requested by a button in the multiplayer screen. Refusal, missing configuration, unsupported browsers, or iframe restrictions leave a clear unavailable message and the durable invitation inbox available. This path does not send server SMS/RCS messages.
- Browser subscriptions are account-owned, expire after 30 days without renewal, can be revoked, and are rebound to the latest account using that browser token. Invalid FCM tokens are removed only if they are still the current subscription. Account deletion removes account-owned subscriptions and inbox entries; the delivery worker also checks deletion guards.
- The worker checks the authoritative deadline, active waiting lobby, recipient binding, blocks, deletion and subscription before claiming an event. Provider errors/timeouts are terminal uncertainty. A crash after the irreversible claim can lose a push; replay cannot send another one. **Submitted** means FCM accepted the request, not device delivery.
- A native/browser notification click never accepts automatically. The Jest worker focuses an existing game window and refreshes the inbox; when closed it opens the approved Jest game route, where pending invitations are available from multiplayer.
- Five new direct invitations per inviter per hour and at most one new direct invitation per recipient per minute limit delivery. Private invitations expire after 15 minutes, and acceptance still requires the creator's recent lobby heartbeat. This implements live PvP, so a delayed push cannot resurrect a departed or expired lobby.

## Configuration and deployment

No production deployment, feature activation, real notification or new secret was performed during implementation.

1. Enable the Firebase Cloud Messaging API/registration API for the existing game Firebase project and create/import its Web Push certificate in Firebase Console. Set **only its public certificate key** as `VITE_JEST_CHALLENGE_PUSH_VAPID_KEY` in the Jest build environment. Keep private keys out of Vite/browser configuration. Optionally set `VITE_JEST_PUBLIC_GAME_URL` to the approved `https://jest.com/g/<slug>` route; default is `https://jest.com/g/riddle-q`.
2. Configure server secret `FACEBOOK_NOTIFICATION_APP_ACCESS_TOKEN` with the app's notification credential. Existing `FACEBOOK_UID_SECRET` and `FACEBOOK_APP_ID` must match signed identity exchange. No access token is returned to the browser or stored in delivery events.
3. Deploy the updated `joinLiveRace`, `updateLiveRace`, `getLiveRaceChallenge`, new `sendLiveRaceChallenge`, `listLiveRaceChallenges`, `setLiveRacePushSubscription`, and `deliverLiveRaceChallengePush`, plus `firestore.indexes.json`. The new TTL fields cover `liveRacePushOutbox`, `liveRaceInvitations` and `liveRacePushTokens`; existing `facebookNotificationAttempts` TTL remains relevant.
4. Set `JEST_CHALLENGE_PUSH_ENABLED=1` and/or `FACEBOOK_CHALLENGE_PUSH_ENABLED=1` only for the configured delivery paths. `FACEBOOK_DISABLED_FEATURES=notifications` remains the emergency-off switch. Without activation, invitations are saved and provider sends are skipped; old terminal events are not replayed when enabling.
5. Facebook recipients must have server-recorded notification consent. Confirm the actual app's native notification/bot eligibility and hosted delivery. Capture a real provider acknowledgement fixture before adding a confirmation decoder or releasing uncertain slots. Messenger delivery additionally depends on bot configuration/subscription; Facebook filters channels.
6. Verify with two registered sandbox players on actual mobile/desktop platform hosts: recipient permission/registration, closed browser, live creator waiting, incoming notification, explicit acceptance into the existing lobby, expiry, opt-out and deletion. Browser push permission/service-worker support is host-dependent; unsupported Jest frames use native SMS invitations and the inbox.

## Verification

- 16 emulator tests cover atomic targeting/inbox/outbox, normalization, duplicate/concurrent sends, original lobby acceptance, recipient-language copy, one-time delivery, ambiguous transport, opt-out, stale subscriptions, shared-device ownership, blocks, deletion, expiry/cancellation/acceptance, forged deadlines, native Facebook ledger composition, and registered-only subscription/revocation.
- The six existing invitation tests pass alongside these checks.
- 31 focused client transport/adapter/entry tests and 25 Facebook transport tests pass. Three service-worker tests cover payload validation, expiry, focus/opaque click messages and the approved offline launch route. HTTP and SDK boundaries are injected; no person receives a test message.
- The browser harness passes Jest and Facebook at 390×844 and 1280×900, including native dialog recovery, direct username invitation, durable inbox, no automatic join, consent refusal/enable/revoke, 48px controls, original lobby/countdown and gameplay. Phone screenshots were inspected.
- All six production artifacts build and pass target isolation audits. Browser messaging and its local worker ship only in Jest; Facebook uses its server provider path. Reddit stays same-origin and the three solo artifacts remain self-contained.
- Portal/functions type checks, module cycles, file-size, security, secret and scalability checks pass. The global TSDoc check still reports unrelated concurrently edited declarations; new notification declarations are documented.

Evidence: `artifacts/live-pvp-offline-push/` and `artifacts/live-pvp-invitations/browser/`.

Official contracts: [Jest notifications](https://docs.jest.com/sdk/notifications), [Meta Zero Permissions notifications](https://developers.facebook.com/documentation/games/build/zero-permissions/social-features/notifications), [Firebase Web Messaging setup](https://firebase.google.com/docs/cloud-messaging/web/get-started), [Firebase background message handling](https://firebase.google.com/docs/cloud-messaging/web/receive-messages).
