# Jest and Facebook native analytics verification

Verified on 2 October 2026. Changes are local; no build was uploaded, activated, or published.

## Finding and fix

The shared game event helpers had no production destination. Collection defaulted closed for the external sink, so shared screen, button, gameplay, error-kind, and purchase events were discarded. Jest's separate attributed funnel already called its native SDK; Facebook had no native event adapter.

The shared event stream now has an independent native destination composed by each target after successful startup. Jest uses `captureEvent`, preserving JSON item arrays. Facebook uses advertised `logEvent` after authenticated startup, a successful configuration read, and the configured 13+ audience gate. Meta dimensions are strings, limited to 25 keys and 100 characters per value; purchase item fields are flattened and numeric value is also supplied through `valueToSum`. Attributed Jest funnel events retain one native delivery path.

Both native connections check the active session and account-deletion gate. Cleanup disconnects only its own destination. Provider failures cannot interrupt gameplay. Sensitive keys are stripped before shared native delivery. Google Analytics remains disabled and its separate external collection gate is unchanged.

Provider contracts checked against [Jest custom events](https://docs.jest.com/guides/custom-events), [Jest analytics lifecycle](https://docs.jest.com/sdk/analytics?engine=html5), [Meta's SDK reference](https://developers.facebook.com/documentation/games/build/sdk), and the public [FBInstant v8 SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js).

## Verification

- Portal TypeScript check passed.
- Five focused unit suites passed, 116 tests: shared analytics, Facebook adapter, Jest funnel, Jest SDK adapter, and mock platform.
- The dedicated injected Jest browser journey passed with one native `session_started`, screen and button events, and successful confirmed-gameplay events.
- The injected Facebook browser journey passed, including native startup, screen, button, and confirmed guess-event assertions with the final string-only payload adapter.
- All six production artifacts built successfully: Jest, Facebook, Reddit, YouTube, Netflix candidate, and Yahoo candidate. Their target-boundary and artifact audits passed. Facebook was rebuilt after final string-only payload normalization.
- File-size audit passed. The repository-wide TSDoc audit reports unrelated concurrent gameplay/race declarations; none of the analytics declarations remain in that failure list.

The existing returning-player milestone browser test was initially used for delivery checks, but timed out expecting the Classic puzzle after default onboarding. The dedicated analytics test explicitly enters Classic with Daily already completed and passes. No production gameplay behavior was changed to address that fixture expectation.

## Live read-only checks and remaining boundary

Jest's authenticated `dau_summary` endpoint returns dated activity data through 1 October 2026 for Riddle-Q. The developer SDK warning/error log returned no rows; this log is not the custom-event panel. Riddle-Q is currently unpublished with rejected review status. These reads establish access to platform analytics, not receipt of the new local instrumentation.

Meta's authenticated app inventory returns Riddle Quest (`1748953042991569`) with read access and no restriction status. The available Meta connector exposes app configuration and API health, not Instant Games custom-event receipts.

After the changed builds are released, verify `session_started`, `screen_view`, `button_press`, `guess_submitted`, and `level_end` in the provider dashboards from a real hosted play session. Jest's custom-events panel is under Games → Manage Game → Analytics. Local injected SDK assertions prove calls reach the provider boundary; they do not prove production ingestion or retention. No backend analytics service, GA property, or new SDK is required by this change.
