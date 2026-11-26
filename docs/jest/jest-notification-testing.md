# Jest notification verification

Jest reminders use the [HTML5 notification API](https://docs.jest.com/sdk/html5/notifications) and portal-approved assets. The client schedules for the current registered, opted-in player; Jest owns message delivery and display. The notification manager, backend transports and account-preference callable are unchanged. See [notification responsibilities](../common/notifications/README.md).

The canonical campaign is `platforms/web/jest/src/notifications/fundCampaign.json`: seven distinct English ASCII bodies of at most 100 characters, D1-D7 offsets, the approved `riddle-q-notification` image, and Daily return payloads. Stable `riddle-quest-d1-v3` through `riddle-quest-d7-v3` identifiers replace earlier schedules. Opening a reminder selects Daily; coins still require normal gameplay.

Scheduling starts eagerly once registered identity, saved preferences and deletion state are committed. Guests receive no schedules. Settings Off queues cancellation of every current and legacy identifier behind admitted operations. A successful account-preference save remains saved if SDK scheduling fails; the hook retries the SDK work without rolling back consent. Successful operations are retained during bounded partial retries; connectivity recovery and returning to a visible tab trigger reconciliation. A later visit or reconciliation on a new UTC day refreshes the sequence. Account retirement and deletion stop further scheduling, and existing deletion cleanup removes all identifiers.

`pnpm check:jest-notifications`, included in `build:jest`, validates campaign content, offsets, stable identifiers, the configured asset reference and return routing. It does not contact Jest or establish live asset moderation, delivery or a Simulator pass.

Run tests and browser harnesses only when explicitly requested. Existing notification test files describe scheduling, guest and opt-out suppression, retirement, cancellation, retries and operation ordering. No test execution or hosted acceptance is claimed by this implementation update.

For acceptance, use the exact active version and registered Jest sandbox users:

1. Observe all seven SDK schedules in the Simulator with distinct bodies, CTAs, the approved image and valid offsets. Confirm guests and saved opt-outs schedule nothing.
2. Verify repeated startup replaces stable identifiers, partial failures retry without rolling back saved consent, and offline/online or hidden/visible recovery respects the latest preference.
3. Switch Off during pending work and verify all current and legacy identifiers are removed. Repeat account deletion and account changes without allowing retired sessions to reschedule.
4. Verify Daily entry from each campaign payload and normal gameplay rewards. Record scheduling acceptance separately from actual delivery and inspect moderation/provider errors in the Console.

Keep the Simulator's server-to-server notification declaration off: this integration uses the client SDK. The SDK schedules only for the current player and cannot send an immediate message to another player.

Follow the [standing Jest upload and activation authorization](jest-html5-operations.md#build-and-upload). Live notification sends require explicit authorization. Hosted delivery and device evidence remain pending for the [Fund readiness review](jest-growth-fund-readiness.md).
