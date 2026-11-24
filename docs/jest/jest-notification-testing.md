# Jest notification verification

Run tests only when explicitly requested. The existing focused command is:

```sh
pnpm test:jest-notifications
```

The checks cover legacy schedule cancellation, guest suppression, session retirement while waiting for platform access, individual cancellation failures, asset validation and the notification operation gate. They send no messages. The browser authentication checks also assert that registration and race sharing do not schedule app-authored reminders.

The retired D1–D7 and race templates, locale-copy parser, Firestore configuration writer, canvas card generator and generated Fund report have been removed. Previous reports do not verify the current delivery path.

Notification titles, bodies and images must originate in the notification manager. There is currently no manager-to-Jest content handoff, so the application cancels legacy schedules and creates no new ones. The SDK schedule/remove adapter remains available for that integration. See [platform delivery](../common/notifications/platform-delivery.md#jest).

Once that integration exists, use registered Jest sandbox users to verify manager-authored title, body, CTA and image, stable replacement/cancellation identifiers, eligibility timing and return payloads. Check moderation and provider errors in the Console. Scheduling acceptance does not establish approval or delivery, and the application cannot schedule an immediate message to another player through the current-player SDK.

Do not run a live send, upload or activate a build without the corresponding explicit authorization.
