# Facebook startup recovery — 28 November 2026

**A pending Facebook bootstrap now offers the existing Startup failed / Retry screen after one shared 30-second budget.** Retry reloads the document; it does not repeat SDK initialization in the same document. This record covers local verification before a new Testing upload. The prior version 24 host checks do not verify this change.

The [version 24 desktop observation](facebook-desktop-social-lifecycle-version-24-2026-11-28.md) showed 5% loading in two reads about 54 seconds apart, then ready gameplay after an ordinary reload. That is consistent with pending startup work, but it does not identify the stalled call or prove a Meta SDK cause. Locally held SDK promises reproduced indefinite startup before this change.

[FacebookPlatformBootstrap](../../../platforms/web/facebook/src/FacebookPlatformBootstrap.ts) applies one elapsed-time budget across `initializeAsync`, `startGameAsync`, preference loading and age resolution. Timeout returns a retryable failure and retires the startup attempt. Ownership/deadline checks around waits, including inside the preference reader before locale fallback, prevent late work from progressing or changing the resolved audience. [FacebookPlatformEntry](../../../platforms/web/facebook/src/FacebookPlatformEntry.tsx) also checks ownership before continuing toward authentication. Admitted SDK promises are not cancelled or automatically repeated. A session that completes before expiry remains usable after the startup deadline.

The timer still depends on browser execution. Monotonic checks reject late continuations even when the timeout callback has not run; this is not a guarantee that a suspended browser renders an error at exactly 30 seconds, nor a deadline for later authentication/backend work.

## Local verification

The final combined run passed **44 tests across two suites in 4.886 seconds**: 43 [bootstrap tests](../../../platforms/web/facebook/src/__tests__/FacebookPlatformBootstrap.test.ts) and one [built-entry browser test](../../../platforms/web/facebook/src/__tests__/facebookStartupRecovery.jest-playwright.test.ts) covering four scenarios. Unit coverage includes every pending bootstrap stage, late resolution/rejection, owner retirement, the shared budget including synchronous SDK initialization time, delayed timer delivery, late preference fallback, timer cleanup and a successful session completing at 29,999 ms. Earlier red runs reproduced 13 failing cases; the review also reproduced two late-locale failures before the internal preference guard was added. A separate red case showed that allocating the timeout after calling the SDK omitted synchronous initialization time from the budget; the timer is now allocated first using the remaining absolute deadline.

The browser test builds the actual Facebook entry with an isolated SDK fixture and blocks external requests. With a controlled browser clock, held initialization/start show 5%/70%, then the actual error UI and enabled Retry. Late resolution or rejection adds no progress/player/storage/identity activity. Retry performs real navigation into a new document with one SDK initialization. These are local outcomes, not Facebook-hosted acceptance. The full browser regression had not been rerun at this pre-upload stage; the later follow-up below records that check.

Final shared TypeScript checking passed, and independent review found no remaining actionable issue after the preference correction. The combined-run log SHA-256 is `43d82a0a8a606375264a1064928d933d29ce77252de7b8fe572d57c82c041b27`.

The protected Firebase/configuration/provider-server baseline is unchanged. No backend deployment, new Testing upload, Production promotion, publication or review submission is included. The original host-startup cause, separate Android issue and remaining submission journeys stay open.

## Post-upload browser regression follow-up

On 28 November, the existing [Facebook built-entry browser regression](../../../platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts) passed on documentation head `cd336bf80fb891661102aec4e612a48510a57e85`, whose application source matches uploaded version 25: **one suite and one test, 39.009 seconds** (39.309 seconds command wall time). The command was `PORTAL_BROWSER_TESTS=1 pnpm exec jest --runInBand platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts`.

The isolated fixture covered its existing authenticated restore, failure recovery, pause/reload, optional API and multiplayer journeys. Its artifact audit passed with 421 files, 4.47 MB total and 0.58 MB initial resources, without Jest gaming-platform, native-module or secret leakage. The four historical screenshot fixtures were saved before execution and restored byte-for-byte afterward; all SHA-256 values matched. No application, Firebase, provider or deployment state changed.

The private test log is `/tmp/rq-facebook-browser-regression-jobilqp7/test.log`, SHA-256 `c170c98c69925386e19bda059f07dd3be788751bdbc55db98795a558643ad3bd`. This regression does not explain the [native version 25 startup failure](facebook-chrome-startup-version-25-2026-11-28.md), prove native Retry success or complete the submission checklist.
