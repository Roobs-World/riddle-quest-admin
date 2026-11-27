# Facebook client review and preparation recovery — 27 November 2026

This follow-up reviews the expanded Riddle Quest integrations against the repository rules and the [API submission checklist](../facebook-api-submission-checklist-2026-11-27.md). The review baseline is `62ae0e4003d4fdb00b93c987aad0b1fda2ec6b59`; version 11's exact uploaded source is `85b8c43d72bca17280592b33eec690c23756c78c`. These corrections require a new candidate before they can be claimed on Meta.

## Standards review

The review found one provider-ownership violation: the shared Settings action union and renderer defined the Facebook Messenger action. Facebook now owns its action IDs and translation-key map. Shared Settings consumes neutral action descriptors. The Facebook adapter validates an incoming ID against its own actions before native admission; unknown IDs cannot invoke the SDK. Existing visible labels and locales are unchanged. The independent reviewer confirmed this finding is resolved.

A possible duplication between bounded metadata-read helpers was recorded as a judgement call, not a documented violation. Those helpers were left intact because their cancellation/lifetime policies have separate owners.

## API behavior review

Joining a listed native tournament previously changed Facebook context without opening the corresponding official game board. The corrected Facebook controller reconciles context, reads fresh native tournament metadata, and validates ID, context, type, exact day/expiry and the strict official payload before returning a locale destination. A current-tournament lookup is preferred when advertised. Otherwise, a fresh tournament list must contain exactly one matching ID/context; pre-join metadata is not reused.

The Facebook lobby then opens the existing official board and foreign-locale guidance without changing the player's language. Cancelled panels, retired accounts/controllers, context replacement and stale reads cannot navigate. Private, malformed, expired, missing or ambiguous entries do not authorize an official destination. The Meta [tournament contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/tournament) documents that joining switches context and that active listings include tournaments the player participates in, supporting this fresh-list fallback on hosts without `getTournamentAsync`.

## Hosted ad observation and bounded preparation

On exact Testing version 11, five accepted incorrect Classic guesses reached **Out of Attempts** with **625 coins**. Selecting **Watch an ad for another attempt** remained on Loading for several minutes, with no visible native ad, continuation or coin change. Meta's debug console showed a completed `getFacebookClientConfiguration` resource request taking 1,215 ms. A later fresh host load remained at 0%, with an empty outer game frame and no inner game bundle. These are incomplete hosted observations, not successful ad acceptance.

Source tracing excludes a queued prior chooser: the dialog gate immediately rejects a busy SDK and the disabled banner registers no guard. The completed HTTP resource does not prove its caller promise settled; native acquisition versus loading was not individually observed. Neither preparation operation previously had a deadline. The controlled regression reproduced indefinite pending behavior in both phases and both ad formats: **four failures and two passing display-lifetime checks** before the correction.

Ad acquisition and loading now each have a **30-second observation deadline**. A deadline returns a recoverable failure and releases game/dialog UI, but retains the pending-preparation guard until the actual native promise settles. No duplicate preparation is admitted while that promise is unresolved. A late result cannot proceed to display or earn continuation. Late rejections are drained. The feature remains visible so a fresh attempt can be requested after settlement. An admitted `showAsync` is never released merely because this preparation deadline passes.

## Verification and limits

- Ad preparation, placement binding and rewarded continuation: **51 tests across three suites passed**, including late completion/rejection, blocked duplicate requests and persistent ownership during a displayed ad.
- Settings, Messenger consent and expanded host actions: **37 tests across three suites passed**; shared typecheck passed.
- Tournament join, native social and strict entry parsing: **48 tests across three suites passed**, including the fresh-list host fallback.
- Final combined focused run: **136 tests across nine suites passed**.
- Combined browser: **one suite, one journey passed in 28.698 seconds**. It covers held acquisition/loading, restored coin/skip controls, no duplicate preparation or late show/claim, a fresh retry through the same visible button, existing cancellation/no-fill/completion/claim-delivery recovery, and native tournament navigation with and without the current-tournament getter.
- The browser harness built an isolated Facebook artifact: **420 files, 4.50 MB total, 0.71 MB initial resources**, with no Jest gaming SDK, native modules or credential leakage. The [tournament locale guidance](expanded-api-2026-11-27/tournament-join-locale-mobile.png) was visually inspected.
- Canonical archive identity and exact hosted acceptance are recorded separately after the new candidate is uploaded.

Logs are `/tmp/facebook-ad-preparation-red.log`, `/tmp/facebook-ad-preparation-final.log`, `/tmp/facebook-settings-boundary-tests.log`, `/tmp/facebook-integration-review-focused.log`, and `/tmp/facebook-browser-timeout-and-tournament.log`. The earlier desktop ad attempt is not evidence of successful new-candidate ad loading or reward delivery.

Firebase Functions, configuration and provider server modules remain unchanged from `2834dc910a39aa9add734440ddfb8dfd533d30dc`. No backend deployment is part of this correction. The six documented API gaps and provider prerequisites remain open; this review does not declare the overall submission complete.
