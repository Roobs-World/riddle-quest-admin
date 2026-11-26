# Jest notification verification

Run tests and browser harnesses only when explicitly requested. The root package has no notification test command. Existing test files cover legacy schedule cancellation, guest suppression, session retirement while waiting for platform access, individual cancellation failures, asset validation and the notification operation gate. These checks send no messages. The browser authentication checks also assert that registration and race sharing do not schedule app-authored reminders.

Jest notification delivery is a blocker for the [Growth Fund readiness review](jest-growth-fund-readiness.md). The game saves registered players' account consent and cancels legacy Jest schedules. The manager currently delivers through Android and Facebook only. It has no Jest delivery integration, so neither the game nor the manager sends a new D1-D7 Jest campaign.

The retired D1-D7 and race templates, locale-copy parser, Firestore configuration writer, canvas card generator and generated Fund report have been removed. Previous reports do not verify the current delivery path.

Notification titles, bodies and images must originate in the notification manager. The SDK schedule/remove adapter remains available for a future manager-to-Jest integration. See the [notification responsibilities](../common/notifications/README.md) and [implemented delivery paths](../common/notifications/platform-delivery.md).

Once that integration exists, use registered Jest sandbox users to verify manager-authored title, body, CTA and image, stable replacement/cancellation identifiers, eligibility timing and return payloads. Check moderation and provider errors in the Console. Scheduling acceptance does not establish approval or delivery, and the application cannot schedule an immediate message to another player through the current-player SDK.

The Simulator's server-to-server notification declaration is valid only after an actual server-to-server Jest delivery integration exists and has supporting evidence. Selecting it does not implement delivery or resolve the current blocker.

Follow the [standing Jest upload and activation authorization](jest-html5-operations.md#build-and-upload). Live notification sends still require explicit authorization.
