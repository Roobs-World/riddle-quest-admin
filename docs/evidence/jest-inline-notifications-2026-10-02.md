# Jest inline scheduled notification images

Implemented the October 1, 2026 [Jest notification update](https://docs.jest.com/whats-new#inline-images-for-scheduled-notifications), following the [inline asset contract](https://docs.jest.com/sdk/notifications#attach-an-inline-asset).

Daily D1–D7 reminders now send three reusable personalized PNG cards through `asset`. Race-results reminders use the same renderer and retain the inbox/challenge attribution. Cards use existing translated notification text, draw locally at 900×600, keep words together, and split overlong words or scripts without spaces. No external resources or new locale strings are required.

The notification type excludes simultaneous `asset` and `assetReference`. The registered-player SDK adapter additionally rejects conflicting sources, unsupported MIME types, malformed base64, and images larger than 2MiB decoded. Guest suppression, account-deletion gates, replacement identifiers, and provider error normalization remain in place. Canvas failure, oversized output, or text that cannot fit falls back to the configured approved library reference, then to the platform Hero image when that reference is absent.

Validation:

- Notification suites: 46 tests passed, including fallback, word wrapping, Unicode, size boundaries, and card reuse.
- SDK adapter: 84 tests passed, including inline PNG/JPEG/WebP forwarding and invalid-request rejection before dispatch.
- Injected browser harness: four focused cases passed for decodable daily/race cards, stable-player registration/reload, attributed race sharing, and guest suppression. Every captured image decodes to 900×600, is below 2MiB, and excludes `assetReference`. The latest D1–D7 series contains three unique images; startup may replace the first series after saved progress loads.
- All six production builds and their artifact isolation audits passed: Jest, Facebook, Reddit, YouTube, Netflix, and Yahoo.
- Type checking and `git diff --check` passed. The repository-wide TSDoc failures reported at the initial handoff were resolved in the subsequent documentation fix; the audit now passes across all source declarations.
- Daily and race PNGs were inspected visually. Evidence images and validation logs are under `artifacts/jest-inline-notifications-2026-10-02/`.

No backend changes are required. This verifies local implementation and SDK payloads, not live approval or messaging delivery. Jest moderates and deduplicates inline images in its asset library; rejected images and the 50-new-assets/player/day limit fall back to the Hero image. After uploading the build, inspect the game's `inline-*` assets and moderation/error events using a registered sandbox player, then verify actual delivery and the entry destination. The existing approved `riddle-q-notification` reference remains the rendering fallback. See `docs/jest-notification-testing.md` for the procedure.

No build was uploaded or activated as part of this change.
