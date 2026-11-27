# Facebook ad eligibility

Facebook ads require both the existing configuration authority and a current read of the player's server-owned subscription status. The [deployed source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md) found that Testing version 12's configuration endpoint omits subscription suppression even though the protected local source contains it. The client correction ships in [Testing version 13](evidence/facebook-testing-version-13-2026-11-27.json), separately from the immutable version-12 evidence. Its real nonsubscriber path passed; live subscriber and full backend acceptance remain open.

## Authority and transport

The Facebook-owned entitlement adapter requests only `hasActiveSubscription` from the current verified Firebase user's document. It uses the existing Firebase ID token and renewable Facebook App Check provider, the fixed Firestore HTTPS host, the configured project, the default database and an exact owner document path. It never uses an SDK-save value, arbitrary player ID, custom token, administrative credential or token supplied by an entry link.

Firebase's [REST authentication contract](https://firebase.google.com/docs/firestore/use-rest-api?hl=en) states that Firebase ID tokens use Firestore Security Rules. The inspected deployed rules permit only the authenticated owner's read and prohibit client writes. The [document GET contract](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get) supports a field mask and defaults to strong consistency. The request has no body or write operation. The [Firebase SDK's App Check credentials](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/api/credentials.ts) use the App Check header alongside authentication.

A successful response must identify the expected document and contain a valid Firestore boolean, or omit the legacy subscription field on an existing document. Omission on an existing document means no active subscription, matching the protected server's default. A missing document, wrong document, malformed value, authorization failure, timeout or retired account is unknown and cannot authorize an ad. Request duration and response size are bounded. Credentials, document URLs, account identifiers and response bodies must not enter diagnostics.

This is a single entitlement-field exception to the [browser profile transport](../common/security/SECURITY.md), not a new profile API. Existing profile reads remain encrypted callable operations. Firebase code, rules, configuration and provider server modules remain preserved; the new client operation reads existing authority without changing it.

## Ad behavior

| State | Native acquisition and display | Rewarded action |
| --- | --- | --- |
| Initial or failed entitlement read | Suppressed until a fresh valid read succeeds | May remain available to retry when feature configuration permits |
| Verified active subscription | Suppressed for all formats | Hidden |
| Verified no active subscription | Still subject to existing format flags, placement checks, account lifetime and native eligibility | Available when those checks permit |
| Durable interstitial removal | Interstitial and banner suppressed; otherwise eligible rewarded video remains optional | Unchanged by the durable alone |

The retry offer is not authorization to call the native ad SDK. Fresh eligibility must succeed before acquisition and again before an impression, so an older pending read cannot authorize a later request. Existing preparation deadlines and native-display ownership remain separate: entitlement failure does not pretend an already displayed native ad has closed.

Eligibility refresh is optional background work at startup and on resume. A failed read must not prevent normal game startup, coin/skip controls, account cleanup or later retry. A banner on a physically eligible surface may retry a fresh read on the next visit, without a refresh loop; visible banners hide when authorization is lost. Account retirement invalidates late results and aborts pending entitlement work.

## Acceptance

Focused tests must establish subscriber suppression despite permissive legacy server flags, fail-closed unknown states, retry recovery, late responses, account replacement/deletion, durable-removal behavior and banner lifecycle. Local fixtures prove those controlled cases, not real Firestore/App Check acceptance.

Testing version 13 retained its exact archive identity and [completed a real rewarded continuation](evidence/facebook-native-subscription-version-13-2026-11-27.md). Successful native display establishes that the reviewed client's fresh eligibility gates admitted this nonsubscriber; the nested request was not captured directly. The wire contract and subscriber cases passed with local fixtures. No live subscription-field mutation or backend repair is authorized by this document. Successful reads for a nonsubscriber do not establish native subscriber behavior on an account that has not been tested.
