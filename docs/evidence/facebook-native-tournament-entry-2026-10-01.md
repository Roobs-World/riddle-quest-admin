# Facebook native tournament entry — 1 October 2026

Status: locally implemented and verified; hosted provider acceptance remains required.
This follows the [native presentation capture](facebook-native-tournaments-2026-10-01.md).

A native tournament invitation now opens Tournaments when the authenticated target
capability exists. The Facebook parser accepts only the exact five-field published
envelope, a supported race language, a live UTC-aligned daily window and its exact
official locale/day ID. It forwards only the incoming language as a screen hint.
Extra score, coin, identity or challenge fields reject the entire native destination.
An invalid native hint cannot fall through into an incoming challenge.

The shared host/session path remains optional and capability-filtered. It retains
the selected content language; another invitation language shows the existing
translated incompatibility message. The initial session issues no race mutation,
reads no resume hint and clears no retained run merely because an invitation opens.
Explicit navigation back to Play returns to category selection. Entry replacement
invalidates previous dialog/provider lifetimes through the existing session owner.
No new visible strings or provider imports enter shared modules.

The public v8 SDK's `getEntryPointData` reads decoded entry data from its internal
entry-point object, including its sender/data envelope handling. The source inspected
for the earlier presentation capture remains the contract reference. This is local
implementation evidence; real native recipient envelopes and hosted joins still need
captured provider fixtures.

Executed checks:

- Native envelope and session-entry tests plus race components: 26 passed.
- Full portal: 172 suites / 1,460 tests passed, 95 opt-in tests skipped.
- Rebuilt injected Facebook browser: one journey passed, including same-language
  entry, foreign-language guidance, disabled capability and poisoned-envelope paths,
  as well as the existing native share/create and account/lifecycle journeys.
- All six required artifacts built and passed isolation audits. The Reddit package
  retained 35 passing tests. Both refreshed Jest/Reddit browser journeys passed.
- Portal types passed. TSDoc: 19,043 declarations / 840 files. Source size: 911
  files. Target boundary audit: 242 files / 992 references. Existing 16-locale
  copy/key coverage remains intact.

The current [review manifest](../../artifacts/facebook-tournament-entry-review-2026-10-01/manifest.json)
records selected source hashes, exact ZIP entries, validation logs and screenshots.
The ZIP has 399 entries / 2,761,578 bytes, SHA-256
`1f15f78cb7fef8c02d17ff87e14b821a96e7724fb4c53777ded7f39b995c19aa`.
It includes concurrent dirty worktree changes and is explicitly
ineligible for upload. Historical ZIPs are preserved. No provider upload, install,
deployment, publication, payment or notification activation occurred.

Remaining: real native create/share/join and incoming envelopes, score updates,
numeric display, UTC expiry, age/API matrix, cancellation and physical devices.
Provider standings never supply official ranks or rewards. Commerce verification,
rewarded-ad grant authority, notification delivery/templates and broader release
approval remain independent gates.
