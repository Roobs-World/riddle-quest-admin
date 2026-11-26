# Jest notification verification

Run tests and browser harnesses only when explicitly requested. Build and artifact checks do not establish Simulator acceptance or messaging delivery.

After switching to a corrected build, refresh the whole Simulator page or leave and reopen it before replaying the checklist. Reload app retains the session's recorded SDK errors and first-notification timing failures. See [Simulator checks](https://docs.jest.com/testing/simulator).

The manager owns the seven-day plan, including distinct English bodies of at most 100 characters, CTAs, day offsets and the approved `riddle-q-notification` asset reference. Firebase verifies the registered account and canonical consent before obtaining the plan. The Jest adapter schedules the validated plan through the current-player SDK and cancels current and legacy identifiers on opt-out or account deletion. See [platform delivery](../common/notifications/platform-delivery.md#jest).

For authorized hosted acceptance on the exact uploaded version:

1. As a new guest, complete instructions and confirm the dismissible registration overlay opens. Choose Play as guest and confirm gameplay continues. Registered players must never see this prompt.
2. Complete registration or launch an opted-in registered account. Confirm seven SDK schedules with `scheduledInDays` 1 through 7, distinct bodies no longer than 100 characters, and `assetReference: "riddle-q-notification"`.
3. Confirm that image is present, approved, fully processed and unarchived in the Jest Image Library. The reference was verified on November 26, 2026; later changes require rechecking it.
4. Return to the game and confirm the same seven identifiers replace previous schedules. Turn Notifications Off and confirm every current and legacy identifier is removed; reload and confirm Off is retained.
5. Check manager failures and retries, guest-to-registered session changes, account switching, and deletion while scheduling is pending. No stale operation may schedule after opt-out or deletion.

Scheduling acceptance does not establish delivery. Jest selects the delivery surface and messaging eligibility. No gameplay code receives notification payloads, acknowledges delivery, handles taps or grants response rewards. The adapter never schedules an immediate message to another player.

Follow the [standing Jest upload and activation authorization](jest-html5-operations.md#build-and-upload). Test notification sends require explicit authorization.
