# Test the Jest Fund notification checklist

Run from the repository root:

```sh
pnpm test:jest-notifications
```

Open `/tmp/riddle-quest-notifications/notifications.md` for the readable report, or `notifications.json` for the exact captured payloads. Set `JEST_NOTIFICATION_REPORT_DIR` to keep reports elsewhere. The command sends no messages and does not change a player's schedules.

The tests run the production notification hook and scheduler against a capturing adapter. They check seven daily reminders, three distinct daily bodies, the race-results reminder, ordinary and 24-character player names, the listing name `Riddle-Q`, the configured asset reference, rendered bodies of at most 100 characters, unresolved placeholders, and conservative printable ASCII. Related tests cover guest suppression, replacement, shutdown, copy failures, and rotation.

The default is **English bundled fallback copy**, using representative progress (level 100, 500 wins, 30-day streak). This is not certification of every live player value or remotely managed copy.

```sh
# Check a different locale. Non-ASCII text is reported as a failure for review;
# this does not mean its translations should be deleted or transliterated.
JEST_NOTIFICATION_TEST_LOCALE=fr pnpm test:jest-notifications

# Check an exported Firestore config/notifications document instead of fallback copy.
JEST_NOTIFICATION_COPY_FILE=/tmp/notifications-export.json pnpm test:jest-notifications
```

Use the raw document JSON containing `defaultLocale` and `locales`, not a Firestore backup archive. The report labels its source so fallback results cannot be mistaken for a live check.

## Exercise the checklist immediately in Jest

1. Open **Riddle-Q → Versions → Run in simulator** for the version under test. Alternatively run `pnpm jest:hosted`, then load `http://localhost:3000` in the Simulator's URL mode. Do not append `?harness=jest`: that enables the app's separate deterministic harness rather than the Simulator SDK integration.
2. In **Config → Player**, use a **registered** player and reload. Guests intentionally schedule nothing.
3. Inspect notification SDK activity and the Fund checklist. Startup should replace the D1–D7 reminders. Expect `Riddle-Q` in titles, three different daily bodies, and an inline PNG `asset` for each reminder. The three personalized cards reuse the rendered translated notification copy and are rotated across D1–D7. No request combines `asset` and `assetReference`.
4. For the race reminder, complete Race to 10 and select **Send challenge**. Expect identifier `race_to_10_results_v1`, a D1 schedule, and an entry payload targeting `inbox`.
5. Inspect the inline cards and the fallback reference in **Config → Notification assets**. Existing-game sessions can preload the real library; manually configured entries are only simulation evidence. Keep a screenshot of the version and checklist results.

The Simulator observes scheduling calls immediately; it does not send real messages. Its Config changes do not update the platform. See [Simulator documentation](https://docs.jest.com/testing/simulator) and [version/asset preload updates](https://docs.jest.com/whats-new).

## Verify the two asset requirements and delivery

The October 1, 2026 [inline asset API](https://docs.jest.com/sdk/notifications#attach-an-inline-asset) is used by both daily and race-results reminders. Cards are generated locally at 900×600 (3:2) with bundled translated text and system fonts. The registered-player adapter accepts PNG, JPEG, and WebP base64 data URLs up to 2MiB decoded, rejects conflicting sources or invalid encoding before SDK dispatch, and preserves normal terminal/retryable SDK outcomes. Failed canvas rendering falls back to `riddle-q-notification` when configured, otherwise Jest's Hero image. Guest and account-deletion scheduling gates still apply.

Jest stores and deduplicates these images as `inline-*` assets and moderates them before delivery. Rejected images, or more than 50 new images per player per day, fall back to the Hero image. Do not claim approval or delivery from a successful scheduling call.

The Node checklist exercises the library fallback because it has no canvas. The injected browser harness verifies real PNG decoding, 3:2 dimensions, the 2MiB limit, reuse of three daily cards, the race destination, and exclusion of `assetReference`:

```sh
PORTAL_BROWSER_TESTS=1 PORTAL_USE_EXISTING_BUILD=1 \
  JEST_NOTIFICATION_IMAGE_REPORT_DIR=/tmp/riddle-quest-inline-cards \
  pnpm --filter @riddle-quest/portal test --runInBand \
  src/jest/__tests__/authentication.jest-playwright.test.ts \
  -t 'schedules decodable inline daily and race cards'
```

Run `pnpm --filter @riddle-quest/portal build:jest` first. The optional report directory saves the three daily cards and race card for visual review. The existing library-reference Fund rules may need Jest's updated inline-image checklist; inspect the SDK `asset` payload and Console assets as evidence for this path.

If every Simulator rule stays Waiting, load `http://localhost:3000/index.html` directly and reload the Simulator session. The root development redirect must preserve the host-provided `sid` and `tce` query parameters. Earlier versions dropped them, causing the SDK to select its local mock and bypass the Simulator checklist. The redirect now preserves the original query string. Do not invent a session ID; let the Simulator supply it.

| Requirement | Evidence needed |
| --- | --- |
| Reference exists in library | Find the exact `riddle-q-notification` reference in Riddle-Q's Developer Console Image Library. |
| Asset approved | Confirm that asset is approved/Pass and not archived. A locally configured Simulator reference is insufficient. |
| Inline assets accepted and approved | Inspect the game's `inline-*` images, verify moderation status, and check Events for fallback/error reports. |
| Notification accepted | Use a registered sandbox user, open the uploaded version, and inspect its scheduled notifications in the Console. |
| Delivery and destination | Inspect the sandbox user's inbox; open a daily reminder and a race-results reminder and check their destinations. |

Use **Sandbox Users → Generate Login Link** to test with your own sandbox account. Scheduling success does not guarantee SMS/RCS delivery at a particular time. Check **Events → Moderation/Errors** for blocked copy or asset problems. Invalid assets can fall back to the Hero image, so seeing an image alone is not approval evidence. See [sandbox testing](https://docs.jest.com/testing/sandbox) and [notification assets and delivery](https://docs.jest.com/sdk/notifications).

The automated report deliberately leaves asset-library existence, approval, and delivery **UNVERIFIED**. Record the version, locale, copy source, asset status, and Console evidence before claiming all Fund checks pass.

## Documentation discrepancy

The supplied Fund checklist and Simulator rules ask for the app name; the [general notification guide](https://docs.jest.com/guides/notifications) says the platform adds it automatically. This test follows the supplied checklist and checks the title for `Riddle-Q`. It applies the stricter 100-character Fund body limit, even though the SDK accepts longer bodies. “Basic characters” is interpreted conservatively as printable ASCII; Jest's moderation decision remains external.
