# Facebook port verification — 2026-09-19

## Public Facebook Page information

At the owner's request, Page `61593702081276` was populated through its signed-in Page editor. Saved and read back:

- Bio: “Crack riddles, follow colour clues and find the hidden word. Discover Riddle Quest, get game updates and join fellow puzzle lovers.”
- Privacy Policy: `https://roobsworld.com/privacy`.
- Public support email: `grindheadgames@gmail.com`, explicitly approved by the owner, saved and read back from the Page Email section.

The existing `roobsworld.com` website and Video game category were preserved. No public launch claim or feed post was added. Automatic approval review initially blocked publishing the support email until the owner explicitly approved that exact address. After approval, the address was saved and verified. Business address, legal entity, founding date, and other unknown facts were not invented. These Page metadata edits do not change any game build.

## Latest staged build

**Version 2, bundle `28534304219568921`, is now Testing; the app is unpublished.** It replaces version 1 for role-account tests.

- Source: clean isolated commit `828f46dbfda0764b13c42087dc4ccc979bd659bd`.
- ZIP SHA-256: `307271b988bc3b0439be568cfa5b203d1f499c7f6ec85effddfac688941f3ce9`; 2,745,506 bytes, 421 entries.
- Immutable ZIP and accepted receipt: `/tmp/riddle-quest-facebook-meta/packages/portal/.facebook-upload-receipts/`.
- Meta evidence: `/tmp/riddle-quest-meta-evidence/meta-version-2-accepted.png` and `meta-version-2-testing.png`.
- This build includes Facebook loading-copy and onboarding fixes plus the staged purchase parser compatibility changes described below. Commerce remains unavailable pending provider setup and verified purchase/refund integration.

Live version 1 exposed an unintended third onboarding step asking Facebook players to register with Jest. The host projected an absent account-upgrade capability as `platformRegistered: false`. It now preserves `undefined` when no upgrade flow exists; Jest's explicit available/complete states remain unchanged. The Facebook browser harness now exercises first-time onboarding: it failed with `2/3` before the fix and passes with `2/2` and no registration controls after it. Existing translations were reused; the Jest registration copy remains used by Jest.

Fresh `verify:all-targets` completed with exit 0 after these changes: all four builds/audits, 126 release-script tests, YouTube unit checks, Jest gameplay and 28 authentication browser tests, and Facebook/Reddit/YouTube browser suites passed. YouTube remains an engineering fixture rather than a release-ready content bundle.

The exact version 2 Play link was then verified on Facebook. First-time onboarding showed `2/2`, completed, and exposed zero Jest registration controls. A real Classic answer (`BEAVER`) completed through `submitSinglePlayerGuess` and `completeGame`; the UI awarded 150 coins, moved the balance from 300 to 450, and displayed First Win. Several completion requests appeared in resource timings, but the observed final balance reflected one award. This is a single hosted success observation, not a comprehensive live contention test. Private screenshots: `version-2-onboarding-complete.png` and `version-2-first-win.png` under `/tmp/riddle-quest-meta-evidence/`.

## Meta-hosted update

After the owner signed into the automation browser, the live dashboard was inspected and a corrected build was uploaded and staged for role-account testing. **Version 1, bundle instance `29649806651275216`, was the first accepted test build**, now superseded by version 2 above. The app was not published or pushed to production.

- Uploaded ZIP SHA-256: `94d44aa2ef872b3bd5ee5ee75d77ad6815ff4e3b37a12e77473b7413817e98b1` (2,745,521 bytes).
- Clean source commit: `2c503ee9ab93dac59d2c73120140ae608c35df31`, built in `/tmp/riddle-quest-facebook-meta`. The same source fixes are present as uncommitted changes in the main workspace; unrelated work was preserved.
- Acceptance receipt and immutable ZIP: `/tmp/riddle-quest-facebook-meta/packages/portal/.facebook-upload-receipts/`.
- Dashboard evidence: `/tmp/riddle-quest-meta-evidence/meta-version-1-scanning.png` and `meta-version-1-testing.png`. The acceptance CLI bound the bundle ID and evidence hash to the exact uploaded ZIP.

Live Meta validation exposed two gaps that local tests previously missed. The shared game frame shipped an unused direct `window.parent.postMessage` fallback; the Facebook target now compiles that fallback out and uses its local bridge. Meta's private-API rejection disappeared after this change. The generated bundle manifest was also rejected: `NAV_2` was explicitly refused, and the SDK-version/orientation combination was rejected with a generic invalid-value error. The accepted manifest uses `platform_version: RICH_GAMEPLAY` and `navigation_menu_version: NAV_FLOATING`, with orientation managed in the dashboard. SDK v8 remains loaded from Meta's CDN. Artifact regression tests cover these rejected forms.

The live validator contradicts parts of Meta's [current bundle configuration documentation](https://developers.facebook.com/documentation/games/build/bundle-configuration). The accepted minimal manifest follows Meta's [official sample](https://github.com/fbsamples/fbinstant-samples/blob/main/common/fbapp-config.json). The dashboard currently has Portrait selected. No claim is made that the hosted mobile orientation has been verified.

After the transport fix, `pnpm --filter @qwordly/portal verify:all-targets` completed successfully, including all four builds/audits and injected browser harnesses. Following the final manifest correction, the Facebook artifact was rebuilt and passed its audit; the standalone artifact suite passed all 36 tests and the complete release-script suite passed all 126 tests. The latter required execution outside the sandbox because its subprocess/signal tests could not create stream file descriptors inside it. The main workspace's `dist-facebook` was refreshed with the accepted manifest.

The owner selected **Friends and fellow players** and the sharing consent was confirmed. A hosted retry reached the game but displayed `Startup failed`: the preflight to `issueFacebookIdentityNonce` lacked an allowed-origin response for `https://apps-1748953042991569.apps.fbsbx.com`. The project-specific Facebook origin configuration now includes that exact origin; no wildcard was added. Deployment and live verification are tracked below.

Only `issueFacebookIdentityNonce` and `exchangeFacebookIdentity` were redeployed from the clean checkout; both Node.js 22 update operations completed successfully. The nonce endpoint's actual preflight changed from HTTP 403 to HTTP 204 with the exact `Access-Control-Allow-Origin` value. No Jest/Reddit endpoints, Hosting, or database rules were deployed. An initial deployment from the main workspace was rejected before upload because its local `.env` contains reserved Firebase-prefixed client variables; using the clean checkout with the validated project-specific environment avoided changing unrelated local configuration.

The post-deployment hosted retry returned HTTP 200 for nonce issuance and HTTP 401 for identity exchange. Cloud Functions recorded `invalid-facebook-signature` for that attempt. This establishes a signature-verification failure, not yet its cause. The correct app's Basic settings were opened to verify the App Secret, but Meta requires the owner to re-enter their password. That prompt is pending in the browser; no password or secret was collected in chat or printed. Hosted authenticated gameplay remains unverified.

After the owner completed reauthentication, an in-memory comparison confirmed that the app's actual secret differed from Secret Manager. A fresh real SDK identity signature verified successfully against the actual app secret. Its decoded claim types match the existing verifier (`algorithm`: string, `issued_at`: number, `player_id`: string, `request_payload`: string). The correct secret was transferred directly into the existing `FACEBOOK_APP_SECRET` Secret Manager entry using stdin; no credential value was logged or written into repository evidence. Deployment of the three functions that bind that secret (`issueFacebookIdentityNonce`, `exchangeFacebookIdentity`, `facebookDataDeletionCallback`) was started from the clean checkout. Final live verification follows below.

All three updates completed successfully. A subsequent hosted session returned HTTP 200 for both identity endpoints and loaded the Classic game with its first riddle, keyboard, 300 initial coins, and onboarding. This supersedes the earlier authentication blocker. Payment APIs remain absent from the real SDK's supported API list. The live launch also exposed Facebook's reuse of the Jest-branded loading message; the Facebook entry now uses the existing `Accessibility.LOADING` translation, while the Jest key remains in use and unchanged.

## IAP release requirement

The owner explicitly requires Facebook IAP for this release. Game Payments was added to the Instant Games use case, and Meta confirmed that all seven canonical products were successfully registered. Dashboard rows were checked against Core product IDs, USD base prices, and consumable/durable classifications:

| Product ID suffix (`com.roobsworld.riddlequest.`) | Grant | USD base price | Type |
| --- | --- | --- | --- |
| coinpack1 | 250 coins | 0.99 | Consumable |
| coinpack2 | 550 coins | 1.99 | Consumable |
| coinpack3 | 900 coins | 2.99 | Consumable |
| coinpack4 | 1600 coins | 4.99 | Consumable |
| coinpack5 | 3400 coins | 9.99 | Consumable |
| coinpack6 | 7000 coins | 19.99 | Consumable |
| remove_interstitial_ads | Permanent interstitial-ad removal | 4.99 | Non-consumable |

In-App Test Payment Mode remains enabled. No real purchase was made. Payout setup requires the owner's registered country and business type; these were requested without assuming them. The dashboard also requires IAP approval and a production bundle. The existing Testing bundle is not a production bundle.

A real SDK v8 role-account session was inspected after catalog registration. `FBInstant.payments` exists, but **no `payments.*` method is advertised by `getSupportedAPIs()`**. The game must not expose checkout on that session. Test mode alone has not made the payment APIs available; a real signed receipt cannot yet be captured through a supported purchase flow.

Meta's [IAP guide](https://developers.facebook.com/documentation/games/monetize/in-app-purchases), inspected September 19 (updated August 31), specifies provider-localized currency prices and decimal-string `priceAmount`, and allows deprecated `developerPayload` to be null. Facebook-only parsers now accept these shapes while preserving strict numeric validation, server-authoritative grants, and grant-before-consume recovery. Focused commerce/recovery tests: **41 passed**. Fresh `build:all-targets`: all four artifact audits passed, with YouTube still an engineering content fixture. These parser changes are not in uploaded version 1 and do not enable the staged commerce adapter.

The complete Facebook unit run subsequently passed **16 suites / 104 tests** (the separately verified browser suite remains opt-in).

The [IAP webhook guide](https://developers.facebook.com/documentation/games/monetize/iap-webhooks), updated September 18, describes raw-body HMAC-SHA256 and V2 purchase/refund events. It also requires approved Zero Permission Access or Gaming Profile for actual event delivery, even in development. A verified receipt adapter, real sanitized provider fixtures, refund integration, runtime activation, and full purchase/recovery testing remain required. **Catalog registration is not evidence of functioning in-game IAP.**

Other live dashboard findings:

- Riddle Quest's Required actions page reports no required actions, despite the global badge of 1.
- Zero permissions is selected, and Zero Permission Access is Ready for testing.
- Game listing text and required app/cover images are missing.
- Audience declaration and IARC setup are incomplete. Meta requests confirmation that the game is not aimed at children under 13 by September 30. Owner confirmation and publisher/contact/country/IARC details were requested; no declaration was submitted.
- No custom CSP entries exist. Meta's dashboard instructs developers to test first and add only required blocked domains. No CSP changes were made.

The initial verification below predates browser access and these live fixes. Its references to missing upload evidence are historical and superseded by the accepted version above. The older main-workspace handoff remains preserved and was not overwritten.

## Initial local verification

The existing Facebook Instant Games Web Target builds successfully and passes its artifact isolation audit. Its implementation includes the FBInstant v8 entry, initialize/start ordering, signed identity exchange, provider storage, pause persistence, and gated social/interstitial capabilities. No application code changes were needed during this verification. The Jest authentication browser harness was changed to use an automatically assigned local port and reject server startup errors promptly after its fixed port collided with another process.

This is local engineering evidence, not evidence of acceptance or publication by Meta. Verification ran against the working tree based on `ad58fe7d22942138d44eed868f7ad5b9c2268610`, with unrelated in-progress Reddit/release changes present. It does not certify an immutable release commit.

## Checks

| Check | Result |
| --- | --- |
| Facebook unit tests | 16 suites, 93 tests passed |
| Full portal unit suite | 126 suites, 738 tests passed; 7 browser/opt-in suites skipped and checked separately where applicable |
| Facebook backend preflight | Passed configuration, secret-boundary/export audits, types, lint, 90 suites / 992 tests, and build |
| Live Firebase deployment inventory | All 21 expected Facebook/supporting entry points present on Node.js 22 in `riddle-quest-ec2b2`; Jest and Reddit identity endpoints also present |
| Facebook profile, commerce activation, visible-copy, and progress audits | Passed |
| Jest artifact | Built; isolation audit passed |
| Facebook artifact | Built; isolation audit passed |
| Reddit artifact | Built; isolation and same-origin audit passed |
| YouTube engineering fixture | Built; isolation audit passed; this is not a complete release content pack |
| Artifact/release script tests | 123 passed |
| Reddit server package | Built; type check, 31 tests, and package contract validation passed |
| Facebook injected browser harness | Passed authenticated restore, failure recovery, pause/reload, and provider overlay lifecycle |
| Reddit injected browser harness | Passed |
| Jest injected browser harnesses | Gameplay passed; all 28 authentication tests passed after the port fix |
| YouTube injected browser harness | All 9 tests passed |
| Portal type check and diff whitespace check | Passed after the harness change |

The initial license check and Reddit release-guard test failed because the execution sandbox could not access pnpm's existing store database. Both passed with store access. No dependency, guard, or license-check changes were made to bypass these checks. Backend checks used Node 24.17.0 and emitted the existing Node 22 engine warning; this run is not a Node 22 runtime certification.

## Reproduce

```sh
pnpm --filter @qwordly/portal verify:all-targets
pnpm --filter @qwordly/portal test --runInBand
pnpm preflight:facebook-backend
pnpm check:facebook-profile-boundary
pnpm check:facebook-commerce-activation
pnpm check:facebook-copy
pnpm check:facebook-progress
pnpm --filter @qwordly/reddit-app build:package:from-client
```

The aggregate `verify:all-targets` run built/audited all four targets and passed release tests and Jest gameplay, then stopped on the occupied Jest authentication port. After fixing that harness, all remaining browser commands passed individually against those builds:

```sh
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test:jest-auth:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test:facebook:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test:reddit:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test:youtube:playwright
```

The Facebook browser harness additionally builds its own isolated, age-gated fixture. The aggregate command was not rerun after its constituent checks passed.

These commands require access to the installed pnpm store. Browser harnesses also require local listening sockets and the installed Playwright Chromium runtime.

## Remaining platform evidence

The owner confirmed the Riddle Quest Meta developer app as `1748953042991569`, with dashboard URL https://developers.facebook.com/apps/1748953042991569/dashboard/. Their subsequent dashboard link includes business context `2198725140593714`; this records the supplied business ID, not verified ownership or Business verification status. The project-specific Functions environment already used this app ID. The root and default Functions environment files contained different historical IDs and were aligned with the confirmed app. The deployment environment validator and Facebook secret-boundary audit passed afterward. This updates local configuration only; it does not establish that server secrets belong to this app or prove Meta accepted a draft. The dashboard is not accessible through the current web tool.

The live deployment inventory was read through the Firebase connector on 2026-09-19 and compared with `EXPECTED_FACEBOOK_EXPORTS` in `firebase-functions/scripts/audit-facebook-backend-exports.js`. It establishes endpoint presence and runtime only, not deployed-source equivalence, correct live secret values, successful signed-player authentication, or hosted SDK acceptance. No production player records were read or changed.

The owner subsequently supplied a Meta dashboard screenshot showing Riddle Quest selected. Green completion indicators appear beside “Customize the Launch an Instant Game on Facebook and Messenger use case”, “Review and complete testing requirements”, and “Business verification”. The app is explicitly “Unpublished”; App Review and the final publish checklist lack the green completion indicator, and Required actions shows a badge of 1. This is dashboard-summary evidence supplied in the conversation. It does not show an uploaded build/version, ZIP hash, playable session, the content of the required action, or Approved Partner approval. The next screen to inspect is the Instant Game use-case customization opened from the first dashboard row.

- Meta-hosted role-account verification remains necessary for identity, connectivity/CSP, lifecycle, and enabled provider capabilities. Injected SDK tests do not establish real-platform acceptance.
- Purchases, rewarded coin ads, and notifications remain deliberately unexposed pending verified provider contracts, as described in the [Facebook operations runbook](../facebook-instant-games-operations.md).
- An existing local upload barrier is still `transmitting` for SHA-256 `25102bb69a8d9c43092140ec9916700181faf1a60e03bf00539a237d1878571e`. Its archive and receipts were preserved. Reconcile that exact handoff in Meta before starting another handoff or rebuilding the gated ZIP. A local `transmitting` record does not prove that Meta received the upload.
- The pending handoff's immutable snapshot exists and matches its hash. However, the singleton gated receipt and rebuildable ZIP already identify a different hash, `400e31798e50489f01bb5713c5ccc0185df83d69ce1b066be0a1847ea9b1b419`. The current outcome CLI selects that singleton, so the existing handoff needs reconciliation before using acceptance/promotion commands. Neither receipt was modified here.
- No backend deployment, Meta upload, publication, or promotion was performed during this verification.

## Subsequent Meta integration work (2026-09-19)

This section supersedes the earlier statements that no upload/deployment occurred and that real hosted verification remained entirely outstanding. The app remains unpublished; this is testing evidence, not production or payment certification.

### Accepted testing build and hosted gameplay

- Meta app: `1748953042991569` (Riddle Quest); linked Page: `61593702081276`.
- Version 2 bundle: `28534304219568921`, accepted and staged as **Testing**.
- Isolated source commit: `828f46dbfda0764b13c42087dc4ccc979bd659bd` in `/tmp/riddle-quest-facebook-meta`.
- Immutable ZIP SHA-256, rechecked: `307271b988bc3b0439be568cfa5b203d1f499c7f6ec85effddfac688941f3ce9`.
- Fixed the Facebook manifest and removed the unused parent-message transport from the Facebook artifact after Meta validation rejected them.
- Corrected the app-specific hosted origin allowlist and app-secret binding. Redeployed the Facebook identity functions and signed deletion callback from the isolated worktree. No secret values are recorded here.
- Real Meta-hosted sign-in and gameplay succeeded. Version 2 onboarding has two steps, without Jest registration. The first Classic answer awarded 150 coins, taking the observed balance from 300 to 450, and displayed the First Win achievement.
- Private screenshots are in `/tmp/riddle-quest-meta-evidence/`: `meta-version-2-accepted.png`, `meta-version-2-testing.png`, `version-2-onboarding-complete.png`, and `version-2-first-win.png`.

### Isolation verification after the fixes

The complete `pnpm --filter @qwordly/portal verify:all-targets` command subsequently passed, including all four artifact builds/audits, release-script tests, Jest gameplay and 28 authentication browser tests, Facebook onboarding/gameplay harness, Reddit browser harness, and nine YouTube browser tests. The YouTube build remains an engineering fixture, not a certified complete release content pack. Log: `/tmp/facebook-onboarding-all-targets.log`. The Facebook unit suite subsequently passed 16 suites / 104 tests. These checks establish the tested target boundaries, not universal absence of regressions.

### Meta metadata and privacy integration

The Page bio, approved privacy URL, and owner-approved support email were saved in the prior Page setup work. The Instant Games listing draft currently contains:

- Tagline: `Crack the clues. Find the word.`
- Category: `Trivia & Word`.
- Short description: `Solve riddles with colour clues, build your streak and take on daily word puzzles in Riddle Quest.`
- Long description: `Put your word skills to the test in Riddle Quest. Read the riddle, guess the hidden answer and use colour clues to work out which letters belong and where they fit. Explore Classic puzzles and Daily Challenges, earn in-game coins and use hints when you need a little help. Track your progress and celebrate achievements as you solve. Optional in-app purchases include coin packs and permanent removal of interstitial ads.`

**The listing draft is not saved:** Meta requires a publisher name, which has not been supplied. Purchase wording describes the intended release and must not be presented as currently available functionality. The icon upload was rejected because `assets/images/icon.png` is 1254×1254; the main icon uploader accepts 516×516 through 1024×1024. Its rejected upload modal was cancelled. Icons, cover/banner media, and preview video remain incomplete.

The app's Basic settings had an empty privacy URL and a Facebook-homepage deletion-instructions placeholder. Updated and saved:

- Privacy policy: `https://roobsworld.com/privacy`.
- Deletion type: **Data deletion callback URL**.
- Callback: `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/facebookDataDeletionCallback`.

Meta displayed “Changes saved”; all three settings were read back after a reload. A read-only GET to the callback returned 405 with `invalid-request`, consistent with the POST-only signed callback. This is reachability/configuration evidence; it does not establish a real Meta deletion request has completed.

### Outstanding release and commerce requirements

Meta's Publish screen explicitly reports that the business is not approved to develop on Instant Games, the game has no production bundle, and the game has not been reviewed. Public visibility and Publish are disabled. The health checklist also requires an IARC certificate and confirmation by September 30 that the app follows the terms and is not aimed at children under 13. Business verification on the dashboard is not equivalent to Instant Games partner approval.

All seven intended IAP products were registered in the Meta catalog and payment test mode was enabled. However, the real hosted SDK did not expose payment APIs in `getSupportedAPIs()`. The staged commerce code is deliberately not wired into runtime: verified provider receipt/refund fixtures, the public server verification path, and end-to-end grant/recovery/refund tests remain outstanding. Do not claim IAP is complete, bypass the activation audit, or promote this testing bundle as the requested IAP release.

Owner facts still needed: publisher/legal name, registered business country and business type, and confirmation of the intended age audience. Banking and tax information should be entered directly in Meta. The existing app Terms of Service URL is still a Facebook-homepage placeholder and needs the owner's actual published terms URL. Required listing media and IARC completion also remain outstanding.

### Owner details supplied and saved

The owner supplied publisher **Roobs World** and contact email **grindheadgames@gmail.com**. Updated the Meta app's Contact email, then filled Publisher in the existing Instant Games listing draft and saved it. Reloaded both settings pages: contact email, publisher, and tagline persisted. This supersedes the earlier unsaved-listing/publisher blocker. Roobs World is the supplied publisher name; no legal entity type or registered country is inferred from it.

Registered business country/type, published terms URL, and the intended 13+ audience confirmation remain requested. Media, rating, Meta approvals, and end-to-end commerce verification remain outstanding. No code or target artifact changed in this metadata update.

### UK company, terms, and audience follow-up

The owner confirmed the registered country is the United Kingdom, the business type is Company, and the game is for all ages. Recorded those facts without inferring a registered company number or legal entity suffix. Saved and reloaded Meta's IARC contact fields: `grindheadgames@gmail.com` and `United Kingdom`. This updates IARC contact configuration; it does not establish that payout/business onboarding is complete.

Saved and independently read back the exact Terms of Service URL: `https://roobsworld.com/riddle-quest/terms`. Public GET requests to this URL and its trailing-slash variant both returned HTTP 404, so the page must be published before submission.

The live Audience details screen states that Meta does not allow apps aimed at children under 13 and asks the owner to confirm the app is not aimed at that group by September 30. The owner has been asked whether “all ages” means family-friendly content with a Facebook audience of 13+, or an intended Facebook audience including under-13s. No age declaration was submitted. IARC remains incomplete and no certificate has been added. These metadata-only changes do not alter target artifacts.

### Terms URL published

Created and published the HTML5 Riddle Quest Terms of Service at https://roobsworld.com/riddle-quest/terms using the existing `portfolio` Vercel project. The exact URL now returns HTTP 200 to unauthenticated visitors. Desktop and mobile public browser checks passed. This supersedes the earlier 404 blocker. See [publication evidence](website/riddle-quest-terms-publication-2026-09-19.md) for source provenance, company verification, deployment ID and checks. Facebook age-audience confirmation and the remaining platform/commerce requirements are still outstanding.

## Release-candidate audit and account fix

The owner confirmed a Facebook audience of 13+, authorized artwork resizing, and requested a complete candidate for final approval rather than public publication. Meta recorded the audience declaration. All four required images and the real 28-second gameplay preview were accepted, with no missing-media notice after reload. See [current draft](../facebook-review-draft-2026-09-19.md), which supersedes the earlier media and age blockers.

After owner email verification, Meta Business Settings lists Riddle Quest as owned by Roobs World; the developer Page selector now offers it and the partner form is populated. The form has not been submitted. The business address/website correction still returns “Error performing query”, including a retry after owner verification. No successful save is claimed.

### Account regression repaired locally

The audit found that shared host account authority depended solely on completed Jest registration. Facebook does not expose that upgrade flow, so username edits and deletion failed. Worse, deletion preparation closed the player's operation gate before discovering the missing authority.

The fix adds explicit target-owned account permissions, allows Facebook username changes and deletion, and denies avatar upload because its backend remains Jest-only. The profile no longer offers that unsupported upload. Deletion now verifies authority before preparing destructive work. This is an availability fix; backend authentication and authoritative deletion remain required.

Validation on the modified source:

- All four isolated artifacts built and passed their audits. YouTube remains an engineering content fixture, not a complete certified release pack.
- Portal unit suite: **126 suites / 753 tests passed**; **7 suites / 42 opt-in tests skipped**. Browser tests were run separately.
- Focused account tests: **22 passed**, including absence of guest authority and deletion preparation ordering.
- Jest gameplay browser: **1 passed**; Jest authentication browser: **28 passed**.
- Expanded Facebook browser: **1 passed**, including actual target session assembly, two-step onboarding, profile username changes, absence of avatar uploads, and deletion against isolated fake services. No real player's account was deleted.
- Reddit browser: **1 passed**; YouTube browser: **9 passed**. Release-script tests: **126 passed**; YouTube unit tests: **43 passed**.
- Facebook profile boundary, commerce activation, TSDoc, file-size and whitespace checks passed.

The initial sandboxed build stopped at pnpm's inaccessible SQLite package database. The approved rerun completed the builds. The first expanded Facebook test exposed fixture onboarding/tooltips after reload; completing onboarding and marking the unrelated profile tour seen resolved the harness failure. The passing Facebook test and remaining Reddit/YouTube checks were then run separately; do not describe the earlier interrupted combined command as a passing run.

Logs: `/tmp/riddle-release-verification-fixed-20260919.log`, `/tmp/riddle-facebook-account-browser.log`, `/tmp/riddle-release-portal-unit.log`, `/tmp/riddle-facebook-account-tests.log`, `/tmp/riddle-release-reddit-after-fix.log`, `/tmp/riddle-release-youtube-after-fix.log`.

**The fix is local and not included in Meta Testing version 2.** A new immutable testing bundle and hosted acceptance are still required before owner approval.

An isolated clean checkout subsequently recorded the fix as `7d02b848eb17d2468ed8ab8600c1a0f7235bbc0f`. Its independent Facebook preflight passed and produced a 2,745,554-byte ZIP, SHA-256 `185b01400b24ec52fd6bb86b556c441882dccdf1c15082fa350f48d6791ebb15`. Existing dependencies were copied into the checkout after a cross-filesystem hard-link attempt failed; pnpm was configured to warn instead of attempting to reinstall matching dependencies. The main workspace dependencies were not removed. The clean-source check and artifact/secret-boundary audits passed.

The local hash-scoped handoff was opened and the immutable ZIP selected in Meta's upload dialog. Automatic approval review rejected submitting the upload, requiring explicit owner authorization for that exact external artifact. The owner was asked. This records preparation only; Meta has not accepted or activated this new bundle.

### Remaining external and operational gates

Facebook commerce remains disabled: the seven-product catalog and 41 passing staged commerce/recovery tests do not prove a real checkout. Public signed-receipt verification, authenticated refund delivery, runtime activation and purchase/recovery/refund acceptance remain outstanding. Current official [IAP guidance](https://developers.facebook.com/documentation/games/monetize/in-app-purchases) permits test purchases before approval; [webhook guidance](https://developers.facebook.com/documentation/games/monetize/iap-webhooks) requires approved Zero Permission Access or Gaming Profile even in development. Payment APIs were absent from the actual hosted supported-API list. No charge or final review submission was made.

IARC is still a draft. Reviewed content includes historical war references; the owner chose to retain and rate it accurately. Violence references and digital purchases are selected, but remaining content follow-ups and remote Classic/Daily corpus review are unresolved. No certificate is claimed.

The live `/privacy` URL describes the portfolio website, not Facebook game processing. A [dedicated notice draft](../facebook-privacy-draft.md) records the actual platform boundary and publication gates. The owner approved 90 days after closure for routine reports/support correspondence, with documented dispute/legal exceptions; implementation and the operator assignment remain pending.

Read-only live infrastructure inspection verified Firestore `eur3`, daily backups for seven days, weekly backups for 28 days, EU object storage with seven-day soft deletion, US Facebook identity/gameplay functions, and log retention of 30 days for `_Default` and 400 days for `_Required`. All 17 configured TTL policies were active, but no TTL was listed for identity nonces, retained provider identities, context-board parents, referrals or moderation records. These are configuration observations, not proof that every deletion or international-transfer obligation is satisfied.
