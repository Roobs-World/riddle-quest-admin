# Facebook Live PvP native notification consent — 2 October 2026

The Facebook Live PvP result callback recorded native tournament scores but did
not notify the existing first-win notification coordinator. Solo wins continued
to work. A fresh production-artifact browser regression reproduced the missing
acceptance request after a live ten-solve victory.

The Facebook-owned multiplayer surface now forwards validated terminal results
to that coordinator. It passes whether the result is a win, checks the account
deletion gate, and reports unexpected failures through the existing observer.
The coordinator retains the server-authoritative first-win lease, permanent
acceptance and seven-day retry rules. The target-specific callback is independent
of tournament availability. Shared components receive only a neutral lifecycle
callback; no Facebook SDK enters another platform.

Native consent continues to use FBInstant v8's `canSubscribeBotAsync`,
`isSubscribedBotAsync` and `subscribeBotAsync`. Authenticated configuration,
the 13+ audience gate, SDK support and the shared provider-dialog lock remain
required. This change activates no scheduled delivery and enables no purchase
or rewarded-ad rollout.

The injected Facebook browser now separately tests a fresh first live win with
tournaments enabled and disabled. It proves no prompt on startup, loss or tie;
one server lease and one native subscription after the win; and native score
submission only when the tournament capability exists. The existing solo prompt,
acceptance-before-interstitial, rewarded continuation, native invitation and
tournament assertions remain covered. The SDK data fixture now reads its own
writes within a page, matching the storage contract used to retain acceptance.

Cross-platform verification exposed an older Jest artifact built while concurrent
rank work was in progress. Its Profile screen failed with the exact caught error
`Missing translation for key "Ranks.CLUE_KEEPER_NAME" in locale "en"`. The current
source contains the rank translations in all 16 supported locales. Fresh builds
replace that mixed revision. The Jest avatar fixture now returns a decodable
image for its exact synthetic URL, allowing the real image fallback to stay
enabled while testing the SDK-provided portrait. Production fallback behavior
and the existing browser assertions were preserved.

Executed validation, retained under
`artifacts/facebook-live-consent-2026-10-02/`:

- Six fresh isolated production builds and explicit-directory SDK/artifact audits
  pass: Facebook, Jest, Reddit, YouTube, Netflix and Yahoo. Their retained outputs
  are in the private `live-consent-20261002-final` review cache.
- Facebook and Reddit's production-artifact Chromium journeys both pass.
- Full portal unit invocation: **260 suites / 2,182 tests pass**;
  **15 browser suites / 115 tests are skipped** by this unit invocation.
- **146 release-script tests pass**.
- Fresh Jest authentication browser run: **42 scoped cases pass**, including
  registration, provider avatars, purchases, subscription management,
  notifications and referrals. Its exact selection and progress are retained.
  The **31 recorded-race cases skipped** by this selection remain unresolved
  after the Live PvP redesign; the complete authentication suite is not green.
- `git diff --check` passes.

The retained failed runs distinguish the real Facebook lifecycle regression,
SDK fixture storage mismatch, missing old temporary artifacts, the in-repository
output guard, and the outdated Jest Profile artifact. None is counted as a
passing run or as real provider-host acceptance.

The Facebook MCP app listing independently confirms authenticated read access
to the Riddle Quest app. The separate deployed configuration inspection permits
notification prompt testing while commerce and rewarded ads remain disabled.
Hosted Meta permission behavior, physical-device acceptance, signed provider
fixtures, purchase/refund verification, notification delivery/cancellation,
review reconciliation, translation approval and IAM readiness remain separate
release work. The review cache is local diagnostic evidence from a shared dirty
workspace, not a clean immutable upload candidate. No deployment, upload, provider
settings change, purchase, reward grant or notification send was performed here.
