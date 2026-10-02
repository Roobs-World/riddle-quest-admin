# Facebook native tournaments — 1 October 2026

Status: implemented and locally verified; Meta-hosted acceptance remains outstanding.
This is a dirty-worktree inspection capture, not an upload-eligible release.

The Facebook adapter now presents official daily tournaments through the real v8
SDK. The public [JavaScript SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js)
was inspected read-only: SHA-256
`05be10d677eafba471ca785d5b9f93ad6c2c2505bc41aa3fa5636ec16674d82d`.
Its current-context `shareAsync` payload is `score`/`data`; no tournament ID is
supplied. Only the SDK's explicit `TOURNAMENT_NOT_FOUND` permits creation. The
[official API reference](https://facebook.github.io/meta-instant-games-unity-plugin/documentation/API_REFERENCE.html)
provides context, while the browser contract is taken from the actual v8 JavaScript.
The SDK remains remotely loaded by the Facebook target and is not vendored.

The explicit share control requires authenticated tournament configuration,
verified 13+ audience, advertised/callable tournament APIs and an official player
score. A fresh authenticated server listing supplies the best adjusted time before
each dialog. Native creation uses lower-is-better numeric milliseconds and the
official UTC end time. Creation is itself the provider dialog. Existing native
tournaments must match the exact locale, official daily ID, UTC window, native
expiry and current context. An ambiguous lookup never creates a replacement.
Account/locale/time changes and repeated clicks fail safely through the shared SDK
dialog guard. Cancellation remains ordinary user input.

The five-field payload carries only a versioned kind, locale, official daily ID and
start/end timestamps. It carries no Firebase UID, native player ID, run ID, answer
or reward. Native IDs stay in memory for scope checks. Meta can associate the
native score with its authenticated player; provider retention remains unverified.
An improved authoritative server record may project a fresh official best into the
matching native context. That detached SDK request cannot fail the official
submission, including when optional diagnostics throw. Native standings and
invitation scores never supply official ranks or currency.

The shared UI receives an optional capability. Jest and Reddit expose no native
tournament share, and other targets import no Facebook presentation adapter. The
button reuses existing error copy and has translations in all 16 current UI locales,
a 44-pixel touch target, focus/busy states and separated left-to-right rank/time
columns. The French injected browser verifies mobile and desktop layout, two
rapid clicks opening one creation, fresh server score rather than cached UI score,
existing native sharing, foreign-locale rejection and successful retry.

Executed checks:

- Portal: 170 suites / 1,445 tests passed; 95 opt-in tests skipped. This includes
  10 tournament adapter tests and 11 race component tests.
- Injected Facebook browser: one journey passed with the rebuilt artifact.
  Jest and Reddit browser journeys: two passed.
- All six required target builds and isolated artifact audits passed. The complete
  build log also records the Reddit package's 35 passing tests.
- Portal types passed. TSDoc: 19,020 declarations / 837 files. Source-size audit:
  908 files. Locale audit: 16 locales × 23 namespaces; visible-copy audit: 720
  required values. Tracker validation and whitespace checks are recorded separately.

Two test assertions were corrected during verification: the French fixture first
expected wording different from the existing translated error, and an SSR assertion
assumed React omitted its text-boundary comments. The final browser and full suite
pass. Visual inspection also found joined score columns and default button styling;
both were corrected and verified again in the browser.

The [review manifest](../../artifacts/facebook-tournament-review-2026-10-01/manifest.json)
contains selected source hashes, all 399 archive entry hashes, SDK contract hash,
check counts and zero provider mutations. The inspection ZIP is
`riddle-quest-facebook-native-tournaments-local-review.zip`, 2,761,275 bytes,
SHA-256 `6f2a5a636de1d24a3dd2810d91372239959b1c258394184c5cd77dedbde9b7a0`.
It includes concurrent shared worktree changes and does not prove a clean source
handoff. Historical review ZIPs remain separate.

This capture predates the locally verified [incoming invitation route](facebook-native-tournament-entry-2026-10-01.md).
That follow-up contains the current source hashes and inspection ZIP. The historical
counts and archive above remain evidence for this presentation capture.

Remaining provider acceptance: real Meta create/share/join,
score updates, numeric display, UTC expiry, cancellation, age/API support and
web/iOS/Android journeys. Real SDK availability, review approval and signed
provider fixtures are not proved by injected stubs. No upload, install, deployment,
publication, payment or notification-template activation occurred.
