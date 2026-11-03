# Facebook launch: instructions for every outstanding task

Updated: 2 October 2026. Includes repository verification and fresh read-only checks of the live Meta app and Firebase project. No new version was uploaded, no production configuration was changed and the game was not published.

Every unchecked task below has its own numbered instructions. The IDs match [the Facebook progress tracker](facebook-instant-games-progress.html). All 33 tracker tasks currently marked Not Started, In Progress, or Blocked are included. Additional operational tasks use O-IDs.

## Read this first

You do not need to understand the code to organise the launch. You do need a developer for tasks labelled **Developer** and a cloud operator for tasks labelled **Cloud operator**. “Ask the developer” means hand them the numbered procedure and collect the result; a dashboard click cannot finish missing server code.

The last recorded setup is:

| Item | Recorded position | What remains |
| --- | --- | --- |
| Meta app | Riddle Quest, App ID `1748953042991569` | Recheck access and configuration |
| Business | Verified; Page connected to Roobs World | Correct stale address/website |
| Testing version | Version 4, bundle `28232737223063645` | Replace only when newer code is ready; run full acceptance |
| Public status | Unpublished | Review approval and owner-approved publication |
| Privacy URL | Dedicated notice already saved in Meta | Confirm real operational behaviour matches it |
| Products | Seven products already registered | Payout account and signed purchase/refund implementation |
| Ads | Placements already exist; last recorded status Requesting ads | Fill, frequency and device acceptance |
| Notifications | Bot prompt exists locally; scheduling contract unresolved | Backend rollout, provider contract and actual delivery |
| Translations | 90 drafts, 89 accepted critiques; zero complete bundles | Remove overlong-answer questions and finish the supported-language corpus |
| Source | Contains concurrent, uncommitted work | Reviewed clean release state |

Sources: [approval walkthrough](facebook-approval-walkthrough.md), [testing upload](evidence/facebook-testing-upload-2026-09-27.md), [1 October operations](facebook-instant-games-operations.md), and [translation evidence](evidence/facebook-translation-generation-2026-10-01.md). The tracker and later evidence sometimes disagree. Treat that as a task to reconcile, not a reason to redo an already finished setup.

### What Codex checked and completed on 2 October

1. Read [the verification report](evidence/facebook-launch-verification-2026-10-02.md) for the exact results and limits. These are local/read-only substeps, not a completed public launch.
2. Do not repeat the initial account discovery: the Meta connector now has read access to the correct app. Business verification passes; the app is still in development mode and not live.
3. Complete the configuration review under P0-02: MCP reports contact email unverified and empty generic support/deletion/domain fields. A later Chrome check confirms the saved deletion callback, whose unsigned GET returns 405. Preserve it and obtain signed acceptance; do not infer callback absence from the MCP field. See [the fresh follow-up](evidence/facebook-review-followup-2026-10-02.md).
4. Reconcile App Review before submitting anything: status, requirements and history give conflicting signals. The requirements check refuses submission, while history has no submissions. Do not retry blindly.
5. Continue O-03/P2-01/P5-07/P3-03: nonce and referral TTL are not enabled; a nonce dry-run found 13 records needing backfill; `facebookContextRetentionScheduler` is not deployed. The previews made no database changes.
6. Initial local security, translation-key, type, release-script, backend, rules and six-target build checks passed. Facebook, YouTube and candidate browser checks passed. A later fresh Jest rebuild then failed with TS2353 in newly added `packages/core/src/validation/dailyCalendar.ts`: its `zh` clock is outside the 16 supported locales. Coordinate with the Daily-calendar author, resolve that mismatch and rerun types/all builds; the earlier results do not certify the changed source. Do not confuse translated UI-key coverage with completion of the Facebook riddle corpus.
7. Codex repaired stale browser fixtures without changing gameplay: Help now completes platform onboarding; Classic coin/paid-action tests use the supported already-completed-Daily scenario. Ten focused checks passed, and the full game-browser rerun improved to 17 passed / 1 failed. The long hosted test's Classic pages have now been seeded too: its old-build diagnostic passed the tour but exposed a later missing Race Debut reward popup at line 768. That needs investigation, not removal of the assertion. Reddit's browser failure remains open.
8. Re-run gates after shared source changes. This workspace is changing concurrently and is not a frozen, reviewed release commit.

## How to follow the steps

1. Start with O-01 and O-02.
2. Assign an owner to each task: you, developer, cloud operator, content reviewer, or tester.
3. Finish configuration, secrets, content and backend work before preparing a new testing ZIP.
4. Prepare an immutable testing package under P6-01 and upload the testing draft under P6-06. A testing draft is needed to collect hosted evidence; it is separate from public publication.
5. Test the draft using P0-04, then complete the individual feature procedures.
6. Finish reviews and obtain final publication approval.
7. Promote the exact tested bytes and perform P6-07.
8. Tick a task only after its stated passing result and evidence are present. A successful local test does not prove a real Facebook phone test passed.
9. If a provider contract is unavailable, mark the dependent task Blocked. To launch with that optional feature omitted, agree a smaller release scope, remove its UI/promises, keep it disabled, and update the tracker. Do not label unimplemented functionality Complete.
10. Do not waive identity, deletion, signature verification, secret protection, or data safety.

## Small dictionary

| Word | Plain meaning |
| --- | --- |
| Terminal | A window where you type a command and press Enter |
| Repository | This project folder |
| Backend / Function | Server code that checks identity, saves accounts and awards value |
| SDK / adapter | The approved bridge between the game and Facebook |
| Role account | A real tester account permitted to open an unpublished draft; not automatically a sandbox identity |
| Nonce | A short-lived, one-use challenge proving a login response belongs to this attempt |
| Signature | Provider proof that data was signed with the right secret |
| App Check | A server check that a request comes through an approved application path |
| Fixture | Test data; synthetic data and private real-provider samples have different purposes |
| Idempotent | Repeating a request has the same effect as doing it once |
| UID | The game's internal account identifier |
| TTL | A database expiry rule that eventually removes temporary records |
| Context | The Facebook conversation/group space containing a social game |
| Canonical answer | The exact underlying concept every language must preserve |
| Grapheme | One visible character; it may contain several Unicode code points |
| Artifact / ZIP | The packed files uploaded to Meta |
| SHA-256 / hash | A file fingerprint; matching fingerprints demonstrate matching bytes |
| Kill switch | A server setting that disables one feature |
| Evidence | A dated result another person can check |

## O-01 — [ ] Prepare your workspace and evidence record

**Who:** You and developer. **Why:** Commands must run in the right folder, and results must be traceable.

1. Open a terminal.
2. Type the following command and press Enter:

```sh
cd /home/craig-beswetherick/Documents/riddle-quest
```

3. Run these read-only checks, one line at a time:

```sh
pwd
node --version
pnpm --version
git status --short
git rev-parse HEAD
```

4. Check that `pwd` prints this project folder. Otherwise stop and repeat step 2.
5. Ask the developer to use the repository's required runtime: root `.nvmrc` is Node `24.17.0`; root `package.json` specifies pnpm `11.21.0`. Functions use their separate Node 22 verification workflow. Do not change the system runtime blindly.
6. If dependencies are absent, the developer runs `pnpm install --frozen-lockfile`. A lockfile mismatch is a problem to resolve, not permission to rewrite the lockfile.
7. Create a private launch evidence folder using your file manager, outside this repository. Restrict it to the owner and authorised operators.
8. Create an evidence note for each task. Include task ID, tester, UTC date/time, source commit, backend revision, Meta version, ZIP hash, device/browser, numbered test case, expected result and actual result.
9. Put sanitised summaries in `docs/evidence/` only after review. Keep raw signed payloads, financial details, tokens and identifiable recordings private.
10. When a command ends, read its final result. A nonzero exit or FAIL means stop that procedure, save the error safely and have the developer fix it.
11. Use placeholders such as `EXACT_64_HEX_SHA256` only after replacing them with the actual non-secret value. Never paste a placeholder command unchanged.

**Done when:** The tools work, the source state is recorded, and every task has an assigned person and evidence location.

## O-02 — [ ] Decide and record the launch feature scope

**Who:** Owner and developer.

1. Write down which features must be available on day one: solo play, race, tournaments, referrals, presence, notifications, purchases and ads.
2. For each feature, write Enabled, Disabled pending evidence, or Omitted from this release.
3. Keep commerce and rewarded coin grants disabled while their signature/completion contracts are unresolved.
4. Treat bot subscription and scheduled reminders as two separate features. Subscribing successfully does not demonstrate reminder delivery.
5. Ask the developer to read the deployed configuration and compare it with local configuration. Do not assume a local environment edit changed production.
6. If you omit a feature, have the developer remove or correct its buttons, onboarding promises and translated copy.
7. Run `pnpm check:facebook-copy` and `pnpm --filter @riddle-quest/portal check:locales` after copy changes. New text must exist in every supported locale; removed keys must be checked for remaining use and removed consistently.
8. Record the scope decision in the release evidence and update affected tracker rows honestly.
9. Retain the existing owner boundary: public publication requires final approval. Routine preparation is already in scope; do not invent an extra approval step for each read-only check.

**Done when:** Everyone can identify what is shipping and which incomplete optional features remain disabled.

## P0-01 — [ ] Reconcile Business verification and finish Partner approval

**Who:** Owner / Meta administrator. **Status:** Tracker Not Started; later walkthrough records Business verified and Partner Not Submitted.

**Latest read-only evidence:** Meta reports `business_verification_passes: true`. That does not establish Approved Partner Program acceptance. Do not submit duplicate Business verification paperwork.

1. Open [Meta apps](https://developers.facebook.com/apps/), sign in with the account administering the owning Business, and select App ID `1748953042991569`.
2. Check the app name and owning Business. Save a redacted screenshot. If either is wrong, resolve ownership before continuing.
3. Open the owning Business's verification/security information from the dashboard.
4. Read its actual verification status. If it still says Verified, record that and do not create a duplicate verification request.
5. Compare business address and website with the owner-confirmed details. Correct the stale values only after that confirmation.
6. If a save returns the previously observed Meta query error, preserve its timestamp/reference and ask Meta support to resolve it. Do not invent different company information to make the form pass.
7. If verification is genuinely incomplete, submit only the documents Meta requests, through its secure form. Record the reference and wait for acceptance.
8. Once implementation prerequisites are ready, open the Approved Partner Program application identified in the walkthrough.
9. Review inherited name, ownership, links and platform fields against the current release.
10. If the legacy Apple Team ID field blocks submission, ask Meta which value or exemption applies to this HTML5 game. There is no authorised native app or unnecessary Apple enrolment task.
11. Submit accurate owner-reviewed information and record its application reference.
12. Reopen the application after review; save the actual approval or rejection and address each rejection separately.
13. Update P0-01 to reflect Business and Partner outcomes independently. “Submitted” is not “Approved.”

**Done when:** Business details are correct, required Business verification is accepted, and required Partner approval is recorded.

## P0-02 — [ ] Independently review the app configuration and public URLs

**Who:** Meta administrator, developer and a second reviewer.

**Latest read-only evidence:** The app is not live. MCP reports contact email unverified and empty generic `data_deletion_url`, `support_url` and `base_domains` fields. Chrome Basic settings visibly contains the saved callback `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/facebookDataDeletionCallback`; its unsigned GET returns 405 and deployed metadata confirms ACTIVE/correct app scope. Privacy and terms pages returned HTTP 200. Reachability does not prove signed deletion or independent acceptance. See [the follow-up](evidence/facebook-review-followup-2026-10-02.md).

1. Open the existing app. Do not create another app simply because this task is outstanding.
2. In Settings → Basic, or the current equivalent, inspect App ID, app domains, privacy URL, data deletion configuration and support details.
3. Confirm the dedicated privacy notice is `https://roobsworld.com/riddle-quest/privacy`. Open it logged out and check it loads.
4. Open Firebase Console → project `riddle-quest-ec2b2` → Project settings → Your apps. Read the dedicated Facebook web App ID. It differs from the numeric Meta App ID.
5. Compare the four approved non-secret backend values: `FACEBOOK_APP_ID`, `FACEBOOK_FIREBASE_APP_ID`, `FACEBOOK_GAME_ORIGINS`, `FACEBOOK_DELETION_STATUS_BASE_URL`.
6. Run the evidence wizard if the values need collecting:

```sh
pnpm --filter @riddle-quest/portal facebook:setup
```

7. Read its receipt under `packages/portal/.facebook-setup-receipts`. The wizard does not obtain the Firebase App ID or deploy configuration. A developer must deliberately enter reviewed non-secrets in the Functions environment.
8. Verify each allowed game origin is exactly the HTTPS origin the game uses. An origin is scheme plus hostname and optional port, not an arbitrary page path.
9. Have the developer confirm the Facebook entry/build loads SDK v8 and root `fbapp-config.json`. SDK version is selected by the artifact; do not assume a dashboard dropdown controls it.
10. Check the dashboard's Zero Permission Access status and the recorded 13+ audience. Reconcile any discrepancy with the built configuration.
11. Under app roles/test access, have each authorised tester accept their invitation and open the unpublished game. Document tester labels, not personal identifiers, in public evidence.
12. Have the developer compare the saved callback above with the actual deployed Function and app scope. Preserve the configured value if it matches; change it only when a verified deployment requires a different address. The callback and human-readable status URL serve different purposes.
13. Test the callback through the signed test process in O-05; opening it in a browser alone does not prove deletion.
14. Find the contact-email verification action in Basic settings. Request the verification message once, open the owner's mailbox, follow Meta's verification link, then reload Basic settings and confirm it says verified. If the message never arrives, check spam and the displayed address before requesting another.
15. Find the support URL field in the current app/game details. Enter the existing owner-approved support page if required; do not invent a URL. Open that exact address in a signed-out browser and confirm the support route works. Save and reopen the settings to confirm persistence.
16. Check the domains/origins fields against the actual approved hosted URLs with the developer. Add only fields required by the current product configuration; do not use a wildcard to silence a validation problem. If `base_domains` remains empty because Instant Games uses a different field, record the dashboard evidence instead of assuming a universal requirement.
17. Ask the second reviewer to repeat the URL/settings checks and sign the result.

**Done when:** Values agree across Meta, Firebase and source, tester access works, public URLs load, and the second review is saved.

## P0-03 — [ ] Prove secret issuance and repair provider IAM

**Who:** Cloud operator and developer. **Why:** Browser code must never hold the keys; the runtime must have only approved access.

1. Read [the credential runbook](credential-rotation-runbook.md) and [the IAM findings](evidence/provider-iam-readiness-2026-10-01.md).
2. Inventory current secret names, version dates and the Functions that consume them. Record metadata only.
3. Establish whether the existing Meta app secret was freshly issued for this app and whether historical exposed values were invalidated.
4. If app-secret replacement is required, schedule it with the developer so server verification changes and hosted retesting happen together.
5. Establish whether any Facebook identity records already depend on `FACEBOOK_UID_SECRET`.
6. If they do, preserve that key. Replacing it in place changes account derivation and can break identity/deletion. If exposed, disable Facebook identity and require a reviewed migration before resuming.
7. For a new deployment with no dependent records, provision an independent UID HMAC key through the operator's secure workflow.
8. Store values in Secret Manager. CI can use the approved deployment identity; this repository's audit prohibits passing the two Meta secret values through GitHub Actions. Do not add them to workflow environment variables.
9. Run the local boundary audit:

```sh
pnpm check:facebook-secrets
```

10. In Google Cloud Console → project `riddle-quest-ec2b2` → IAM, inspect runtime principals and inherited project/organisation grants. Inspect secret-level access in Secret Manager.
11. Ask the developer to prepare the actual Functions runtime-service-account changes. Merely creating a new service account does not move a running Function.
12. Grant the new runtime identities the exact reviewed permissions first, deploy the reviewed cutover, and test identity, deletion, gameplay and the other providers.
13. Remove obsolete broad grants only after confirming the old identity is not serving another required workload. Do not remove shared Editor access blindly.
14. Have a second operator review the effective access, including inherited grants and service-account impersonation.
15. Have the security operator compare newly issued secrets against historical exposures privately. Never print either side of that comparison.
16. Save issuance metadata, scan results, deployed runtime identities and the least-privilege review.

**Done when:** New issuance is proved, historical credentials cannot be reused, artifact/source scans pass, and deployed provider access matches the reviewed IAM plan.

## O-03 — [ ] Complete the backend release and temporary-record retention

**Who:** Cloud operator and developer. **Before:** Correct configuration, secret/IAM plan and reviewed source.

**Already completed locally/read-only:** Backend preflight and Node 22 verification passed. The nonce preview scanned 13 records, all needing backfill; referral/context previews found zero records. Live nonce/referral `expiresAt` policies are not enabled. Rate-limit, context-history, tournament and `entries` policies are active. No backfill, TTL activation or deployment has been performed in this run.

1. Ask the developer to review the full Functions/rules release, including shared gameplay, deletion, presence and race dependencies.
2. Check the four non-secret values in `firebase-functions/.env.riddle-quest-ec2b2`. Do not print the complete environment file into a shared log.
3. Run:

```sh
pnpm preflight:facebook-backend
```

4. Require the environment, export inventory, types, lint, full Functions tests and deploy build to pass. Do not use a reduced list of new callable names as the deployment plan.
5. Plan the order of legacy backfills and TTL activation. Enabling TTL can delete old rows; complete the required compatibility/backfill work before enabling the relevant policy. The full deployment command includes indexes, so this ordering must be reviewed before invoking it.
6. Preview nonce retention:

```sh
pnpm --dir firebase-functions facebook:nonces:retention --project riddle-quest-ec2b2 --page-size 100
```

7. Review invalid counts and every emitted continuation cursor. For subsequent pages add `--after` followed by the exact emitted nonce hash.
8. After authorising the previewed maintenance, run the same page with `--apply --confirm-project riddle-quest-ec2b2`. Reuse that page's cursor, then continue until all pages are accounted for.
9. Follow P5-07 separately for referral binding backfills; do not enable referral-token TTL before those dependencies are safe.
10. Deploy the approved full unit with:

```sh
pnpm --dir firebase-functions deploy:facebook-backend
```

11. Save the Firebase result and deployed revisions. This command targets `riddle-quest-ec2b2` and deploys Functions, Firestore rules/indexes, RTDB rules and Storage rules together.
12. In Google Cloud Console → Firestore → Time-to-live, inspect policies for `expiresAt` on `facebookIdentityRateLimits`, `facebookIdentityNonces`, `facebookReferralTokens`, `facebookContextCompetitionHistory`, `facebookTournaments` and the reviewed `entries` collection group.
13. Check each policy against `firebase-functions/firestore.indexes.json`. The `entries` group name can span subcollections, so confirm its intended scope before changing it.
14. Do not add parent TTL to context boards. TTL does not remove their score subcollections; use the transactional cleanup in P3-03.
15. Observe automatic physical removal of disposable expired test records. Keep the game's immediate logical expiry checks; TTL is asynchronous. See [Firebase TTL instructions](https://firebase.google.com/docs/firestore/ttl).
16. Verify deployed identity, configuration and App Check gameplay requests from the test app. Inspect scheduler registration and permissions under P3-03.
17. Record backfill coverage, policy states, observed removal times, rules revisions and a known-good backend rollback plan.

**Done when:** Full backend deployment is verified, required backfills are complete, policies are enabled safely and actual expiry/cleanup has been observed.

## P0-04 — [ ] Run the complete real-host acceptance matrix

**Who:** Developer and testers. **Before:** Backend ready and immutable Testing draft available under P6-01/P6-06.

1. Create one row per test case with three result columns: Facebook web, real iPhone/iPad shell, real Android shell.
2. Record each device model, OS, Facebook/host app version, browser where relevant, Meta bundle version and exact ZIP hash.
3. Open [the recorded game link](https://www.facebook.com/gaming/play/1748953042991569/) with an authorised role account.
4. Confirm the loaded version in the dashboard/iframe corresponds to the candidate. The old version 4 proves only its own bytes.
5. Complete onboarding, start a game, submit a wrong answer, submit a correct answer and reach results.
6. Follow P2-03 and P2-05 for auth, saves and lifecycle, O-05 for deletion, P3 tasks for social features, and P5 tasks for monetization.
7. In desktop developer tools, open Network and Console. Capture only sanitised errors/hostnames and effective response headers.
8. Have the developer compare observed required hosts with the actual Meta-hosted Content Security Policy. The root Firebase Hosting CSP belongs to Jest and cannot prove Facebook CSP compatibility.
9. Exercise every enabled overlay, context, ad and notification capability while watching for blocked requests. Purchase testing remains blocked until P5-03 is ready.
10. Test offline/reconnect and background/resume on the physical devices. Repeat core play after each interruption.
11. Test every omitted/unsupported capability returns understandable unavailable behaviour without blocking solo play.
12. Save a failure as a failure, with its test case and device. Fix source, make a new hashed candidate, and repeat affected tests.
13. Obtain a tester sign-off for all three columns. Record unsupported platform capabilities as such; do not fabricate success.

**Done when:** Every enabled capability has passing real-host/device evidence and every unsupported or omitted capability has a verified fallback.

## P0-05 — [ ] Prove notification delivery across all three platforms

**Who:** Developer and testers. **Before:** P5-09 opt-in and P5-10 scheduling contract.

1. Read P5-09 and P5-10 first. If scheduling is still unimplemented, leave this task Blocked.
2. Use test accounts/devices authorised for notifications; do not send trial messages to public players.
3. Record each device, subscription state, locale and exact candidate hash.
4. Trigger first-win eligibility and accept the native subscription prompt.
5. Complete an active game and record the server's intended D1/D3/D7 reminder set.
6. Run the developer's approved short-delay provider test if available; separately observe the required real delay behaviour. Do not change production clocks to simulate time.
7. Return and complete another game; verify the old schedule is replaced rather than duplicated.
8. Opt out and verify cancellation through provider status and lack of subsequent scheduled delivery over the recorded observation window.
9. Send an authorised race alert to a test rival; open the delivered notification and verify routing to the correct allowed challenge/results.
10. Repeat denial, unsupported delivery, expired deep link and duplicate-event cases.
11. Repeat steps 4–10 on web, iOS and Android.
12. Record scheduled IDs/status privately and sanitised counts/times publicly. Subscription success alone cannot complete this task.

**Done when:** Opt-in, delivery, replacement, cancellation and routing are demonstrated on each supported surface, or the release scope is explicitly changed to omit reminders.

## P0-06 — [ ] Capture provider contracts without publishing reusable credentials

**Who:** Developer and security reviewer.

1. List the required contracts: signed-player identity, purchase, unconsumed purchase, refund/webhook, notification and tournament payload.
2. Locate the official provider documentation or obtain Meta's written description for each contract.
3. With consenting role accounts, capture actual payloads in an authorised private test environment.
4. Store originals only in restricted evidence storage. Do not commit signatures, assertions, payment tokens or identifiable data.
5. For committed schema fixtures, substitute synthetic fields and clearly label them synthetic/redacted.
6. A signature covers the original bytes. Editing its player ID, time or payload invalidates it: never call an edited sample a valid Meta-signature fixture.
7. For repeatable signature unit tests, use a dedicated synthetic test key and sign synthetic data. Document that these test your verifier, not Meta issuance.
8. For provider acceptance, the developer verifies the untouched real sample privately and records only outcome, contract version and sanitised metadata.
9. Build exact-schema parsing tests for missing fields, extra fields, type/size limits and unexpected provider responses.
10. Build failure tests for tampering, expired/replayed requests, wrong app/player/product and raw webhook verification as applicable.
11. Have the security reviewer examine the fixtures and evidence for accidental exposure.
12. Link each contract and its tests to the feature tasks. Leave unavailable contracts visibly Blocked.

**Done when:** Each required provider contract is documented, private real verification passes, committed tests contain safe data, and no edited signature is presented as authentic.

## P2-01 — [ ] Finish real identity acceptance and nonce expiry verification

**Who:** Developer and cloud operator. **Status:** In Progress; local security tests exist.

1. Complete P0-06's private authentic identity capture.
2. Ask the developer to run the existing identity/security/nonce tests through the Functions suite. Use synthetic keys for tamper/replay tests.
3. Test correct nonce, missing nonce, another attempt's nonce, expired nonce, future/stale signing time, wrong app/player, oversized payload and duplicate use.
4. Confirm each rejection happens before issuing auth/App Check tokens or changing an account.
5. Test concurrent attempts and transaction retries in the emulator, including crossing the five-minute nonce deadline during a request.
6. Complete O-03's nonce backfill and TTL verification.
7. With a real role account, perform a new exchange and then attempt a controlled retry of the same challenge through the private developer test.
8. Verify it cannot sign in twice with that one-use challenge.
9. Let a disposable nonce expire; confirm immediate logical rejection and later physical cleanup.
10. Verify the identity rate-limit policy expires temporary quota records without storing raw addresses.
11. Save authentic acceptance outcome, regression output and TTL observation times.

**Done when:** Real signing is accepted, invalid/repeated signing is rejected and deployed nonce/rate-limit retention is observed.

## P2-03 — [ ] Verify Firebase authentication and App Check refresh

**Who:** Developer and tester.

1. Open the Testing draft with a role account.
2. Have the developer inspect authentication using sanitised diagnostics: success status, internal provider and account generation only. Never copy auth/App Check token values.
3. Complete a protected gameplay callable. Confirm both Firebase auth and App Check are required.
4. In the developer's isolated test, omit auth, then omit App Check. Confirm neither can mutate authoritative progress.
5. Keep a session open across the one-hour App Check lifetime, or use the reviewed SDK refresh test; record which method you used.
6. Trigger two actions requiring refresh together and confirm they share one exchange rather than producing a request storm.
7. Simulate a transient exchange failure in the harness; confirm retry recovers.
8. Use O-05 to delete and explicitly start a new generation. Confirm fresh auth/attestation belongs to the new generation.
9. Confirm an old-generation session cannot silently renew into the new account.
10. Repeat the actual protected-call journey on web, iOS and Android.

**Done when:** Hosted login and token renewal work with enforcement enabled, including failure recovery and generation changes.

## P2-05 — [ ] Verify loading, saving, failure recovery and pause/resume

**Who:** Developer and testers.

1. Open a fresh draft session and record the order: initialise SDK, finish loading, start game, then read identity/cloud state.
2. Confirm the loading screen finishes only when the game can actually be played. Facebook uses loading progress and `startGameAsync`; `markGameLoaded()` is a Jest method and must not be introduced here.
3. Change language/audio/preferences, play a game and record the acknowledged state.
4. Reload. Confirm preferences and progress restore; saved language takes precedence over Facebook locale.
5. Background the game while it is visible to the host, then return. Confirm gameplay/audio pause and resume appropriately.
6. Repeat with the phone home button, screen lock and app switching.
7. Have the developer verify writes/flush are serialised and presence stops during pause.
8. Disconnect network access, attempt save/play actions and inspect the retry/error view.
9. Restore connectivity and verify saved authoritative progress is neither lost nor duplicated.
10. Close the host app after a confirmed save, reopen and verify recovery. Record the last acknowledged state; an unacknowledged write is not automatically guaranteed.
11. Test SDK initialisation/start failure in the injected harness. Confirm a useful recoverable view.
12. When commerce is implemented, repeat interrupted purchase and startup/resume recovery under P5-03. Until then record that portion Blocked.
13. Save web/iOS/Android recordings with identifying information removed.

**Done when:** All lifecycle/storage paths pass on the real hosts and purchase recovery is tested or explicitly outside the approved release scope.

## O-04 — [ ] Finish support, listing and IARC rating

**Who:** Owner, support operator, content reviewer and developer.

1. Assign the person monitoring `grindheadgames@gmail.com` for support, privacy and safety reports. Record backup cover and a response target chosen by the owner.
2. Send a harmless test email from an authorised address and confirm the assigned person can receive and respond. Keep addresses/private correspondence out of public evidence.
3. Review existing uploaded media. Replace only missing, inaccurate or outdated images/videos.
4. Open the game description in Meta and compare every feature promise with O-02. Correct “buy coins” wording if checkout is still unavailable.
5. Have the developer update translated game/onboarding copy in every supported locale, check remaining key usage and run the locale/copy checks.
6. Open the rating/IARC questionnaire from the current dashboard.
7. Review the actual riddle corpus and historical themes. The owner already chose 13+ and to retain those themes; answer factually.
8. Complete all required follow-up questions, save the rating/reference and resolve any content change it requires.
9. Recheck public privacy/support links logged out.
10. Have another reviewer compare final listing, age rating and enabled features.

**Done when:** Support has a named operator, rating is complete, media/copy is accurate and no unavailable feature is advertised.

## O-05 — [ ] Accept account deletion on real hosts

**Who:** Developer and disposable-account testers. **Why:** A passing local deletion test does not establish actual Meta storage/device behaviour.

1. Create a disposable test account and record its starting state privately.
2. Play enough to have progress, preferences, known rivals and any eligible test entitlement.
3. Open the existing in-game deletion control and read its warning.
4. Delete the disposable account. Confirm gameplay/presence stops and success appears only after authoritative deletion.
5. Have the developer inspect the approved data inventory to verify the intended cleanup, including queue/report references, context membership and visibility.
6. Repeat the same deletion request in the developer's controlled test and confirm it is harmless.
7. Submit Meta's authentic signed deletion callback privately. Confirm the opaque confirmation code and human-readable status URL.
8. Test invalid signatures and unknown status codes in controlled tests; neither should expose identity or perform deletion.
9. Explicitly start playing again. Confirm a new generation/UID, no old progress and the documented 300 starting coins.
10. Retry an old callback after this fresh start. Confirm it targets the old generation and does not erase the new account.
11. Repeat with two tabs and two devices. Attempt an old-session write after deletion; confirm rejection.
12. Test host support for Web Locks. If missing, the current in-game deletion path fails before server mutation; record the blocker and have the developer design a supported path before claiming acceptance.
13. Check exactly scoped FBInstant data clearing and later reload on web, iOS and Android.
14. Record mixed-version/cross-device behaviour and any residual propagation limitation accurately.

**Done when:** Deletion, safe retries and a separate fresh account are proved on each supported host with no old-data resurrection.

## P3-03 — [ ] Deploy context cleanup and accept shared-context races

**Who:** Cloud operator, developer and two testers.

**Latest read-only evidence:** The cleanup scheduler is still absent from deployed Functions. The empty context preview does not prove automatic cleanup works.

1. Complete O-03's backend release and find `facebookContextRetentionScheduler` in the deployed Functions list. It was absent in the 1 October read.
2. In Cloud Scheduler, inspect the associated schedule, target, invoker identity and execution status. Confirm it is the reviewed hourly job.
3. Preview cleanup with:

```sh
pnpm --dir firebase-functions facebook:contexts:retention --project riddle-quest-ec2b2 --limit 20
```

4. Review aggregate expired-board/score counts, invalid records and excessive fan-out. Do not inspect unrelated player records or increase limits to bypass corruption.
5. After approving the maintenance, apply that bounded scan:

```sh
pnpm --dir firebase-functions facebook:contexts:retention --project riddle-quest-ec2b2 --limit 20 --apply --confirm-project riddle-quest-ec2b2
```

6. Repeat previews/apply scans until a fresh scan is empty; a preview's “complete” does not mean records were deleted.
7. Open the same authorised THREAD/GROUP context as two role accounts in the same locale.
8. Join almost simultaneously. Verify one board and a deterministic host; reload both and check agreement.
9. Submit authoritative race scores, inspect rankings and repeat submissions. Confirm replay does not duplicate scores or currency.
10. Switch contexts. Confirm the new join succeeds before the old leave and retrying does not orphan membership.
11. Test seven-day logical expiry with developer-controlled emulator time, then observe an actual expired disposable hosted board and physical scheduler removal.
12. Verify parent and score entries are removed together; history is identity-free and retains the original board-end-plus-30-day expiry.
13. Race a renewal/rejoin against cleanup in the emulator. Confirm the renewed board survives.
14. Rejoin a fresh hosted context and test deletion of the last member.
15. Repeat context join/switch/invitation flows on web, iOS and Android and save scheduler revision/execution proof.

**Done when:** Scheduler operates safely, expired boards physically disappear and real shared-context flows pass.

## P3-04 — [ ] Accept native tournaments backed by official results

**Who:** Developer and two testers.

1. Enable tournament testing only under reviewed authenticated configuration.
2. Complete an official run and note the server's adjusted time and rank.
3. Create/share a native tournament through the existing Tournaments surface.
4. Have the second tester open the invitation.
5. Verify locale/day/context compatibility and the intended tournament tab; opening an invite must not automatically start a run.
6. Complete another official run and verify native numeric lower-is-better presentation matches the authorised server score.
7. Improve the official time and confirm the SDK score projection reflects the new best without changing currency.
8. Cancel creation/sharing, deny permission and simulate network failure. Confirm only explicit `TOURNAMENT_NOT_FOUND` permits the creation fallback.
9. Use emulator tests to forge incoming Meta standings/score hints. Confirm they cannot change official rank, coins or server results.
10. Verify a different-language invitation shows incompatibility guidance and preserves chosen language.
11. Test the 24-hour UTC window and expired invitation handling.
12. Repeat create/share/join/score/display/cancellation on supported web/iOS/Android surfaces.

**Done when:** Native presentation matches official results, expiry is enforced and Meta standings never become economic authority.

## P3-05 — [ ] Verify provider-rendered names/photos and overlay disposal

**Who:** Developer and tester.

1. Open Facebook social surfaces that show native player identity.
2. Confirm names/photos are rendered through Meta overlays, rather than copied into game state.
3. Have the developer review sanitised network/store/log diagnostics for accidental name/photo collection.
4. Open and close the overlay repeatedly. Navigate away while open and test failed dismissal.
5. Confirm SDK v8 `destroyAsync` disposal occurs and no orphan UI blocks the next action.
6. Test keyboard focus, readable text, screen-reader navigation where supported and small-screen layout.
7. Open another native dialog while the first is active; confirm the common dialog guard prevents overlap.
8. Delete the account or unmount the game while an overlay is active in the controlled test.
9. Repeat lifecycle checks on web/iOS/Android. Redact names/photos in saved recordings.

**Done when:** Provider identity stays in provider UI, overlays dispose correctly and accessibility/lifecycle evidence is saved.

## P3-06 — [ ] Prove opt-in presence with two tabs and two devices

**Who:** Developer and testers.

1. Sign in to disposable account A on two permitted surfaces.
2. Keep presence opted out. Have known rival B verify A is not visible.
3. Opt in and verify B can see approved online state.
4. Start solo play then a race. Verify the aggregate state changes to playing/racing without duplicate people.
5. Close one of A's sessions; confirm the remaining session keeps the appropriate state.
6. Pause/background one session and verify its connection stops without falsely dropping the other.
7. Restore that session; verify reconnect registers once.
8. Kill the last host process or disconnect the network. Observe `onDisconnect` cleanup and the aggregate offline result.
9. Record actual propagation times rather than promising instantaneous network detection.
10. Opt out in one session and verify new presence writes/read eligibility are removed according to the authoritative consent.
11. Repeat on simultaneous physical iOS/Android devices and confirm Jest regression behaviour remains intact.

**Done when:** Only opted-in connections count and aggregate presence converges correctly through crashes, tabs and devices.

## P3-07 — [ ] Prove strangers, blocked rivals and deleted players cannot view presence

**Who:** Developer and three testers.

1. Use A and B as known rivals, plus C as an unrelated test account.
2. Opt A into presence. Verify B can read approved state and C cannot.
3. Have the developer run `pnpm --dir firebase-functions test:race:rules` against its demo emulators; do not weaken live rules to run the test.
4. Keep B's listener open while A opts out. Confirm visibility is revoked.
5. Restore consent, then have A block B. Confirm both visibility directions disappear and blocked interactions are rejected.
6. Attempt B's listener reconnect and a new presence read; confirm rejection.
7. Restore a disposable known-rival relationship through a supported test flow, then delete A. Confirm incoming/outgoing ACLs and presence are removed.
8. Verify owning clients cannot write visibility edges, enumerate strangers or read the server-only reverse index.
9. Record deployed trigger revision and measured revocation propagation on real devices.
10. Confirm no failed social action changes balances or official results.

**Done when:** Rules and actual trigger propagation enforce visibility removal through every relationship-removal path.

## O-06 — [ ] Finish auditable support/moderation closure and retention

**Who:** Owner, developer and authorised support operator.

1. Read [the moderation runbook](facebook-moderation-runbook.md). The existing queue is intake-only; it does not implement adjudication/appeals/closure.
2. Preserve the owner-approved routine-record rule: delete 90 days after closure, with documented dispute/legal exceptions. Do not ask the owner to choose that period again.
3. Have the owner assign operator and backup, investigation/escalation authority, exception approver and appeal route.
4. Have the developer design an auditable closure/exception/purge workflow using approved server tools. Do not add an admin panel or invent fields directly in production.
5. Implement authorised closure timestamps, bounded expiry, exception review and account-deletion compatibility.
6. Test duplicate reports, changed-target replay, the five-reports-per-UTC-day cap, stranger reporting rejection and deletion races in emulators.
7. Deploy the reviewed workflow/purge rules through the backend release and verify its actual access roster.
8. Submit a harmless test report against a known rival and separately block that rival on real hosts.
9. Check report intake, immediate blocking and visibility revocation. Reporting alone must not impose a sanction or change coins/rank.
10. Exercise the approved operator closure/appeal/exception process and verify retention dates.
11. Save a sanitised audit example, operator roster and actual purge evidence; never export raw queue rows into chat or public documents.

**Done when:** Support has an accountable operator and the promised closure/retention process exists and is verified.

## P4-02 — [ ] Remove overlong-answer questions and finish the supported-language corpus

**Who:** Owner/content reviewer and developer.

1. Read [translation evidence](evidence/facebook-translation-generation-2026-10-01.md). The source now contains 177 English riddles after the user-approved exclusions. There are 15 non-English locales. Every bundle must match the final ready English source; the current candidate would require 2,655 translated records. Geography currently has only nine easy questions and is not ready.
2. Open the separate canonical revision proposal under `artifacts/facebook-translations-review-2026-10-01/`. It is a proposal, not an approved source.
3. Review the demonstrated conflicts: German Brazil/Germany answers and Spanish castle exceed the seven-grapheme limit.
4. The user approved removing questions whose faithful answers exceed seven letters. Remove each affected canonical question from every locale. Do not shorten an answer into a different meaning.
5. Review all 180 concepts for native spelling, length, uniqueness, factual accuracy and difficulty; the three known conflicts may not be the only ones.
6. Have the developer update the authoritative source following the approved removal rule, preserving six categories and at least 10 easy plus 5 medium questions per category.
7. Invalidate/rebuild affected hash-bound checkpoints through the reviewed generator workflow. Do not relabel old critique as applying to changed source.
8. Provision the translation API key privately through the approved environment. Keep it out of source and command arguments.
9. Use distinct models supported by your account; recorded generation used these names:

```sh
pnpm --dir firebase-functions race:translations:generate --translator-model gpt-6.1-sol --critic-model gpt-6-astra
```

10. This command makes paid model calls; record the generation scope/budget before running it. It resumes validated checkpoints but does not fix canonical conflicts automatically.
11. Review each stopped/rejected item and repair it through fresh translation and independent critique. Never set a rejection flag to success by hand.
12. Continue until each expected locale file matches the final source exactly and every category can supply the unchanged 10-easy/5-medium race deck.
13. Complete P4-03 before treating any bundle as importable.

**Done when:** All 15 translated bundles exist, each preserves the approved English concept and satisfies count/length constraints.

## P4-03 — [ ] Audit meaning, Unicode, duplicates and the complete corpus

**Who:** Developer and content reviewers.

1. Use the exact approved source and the completed bundle files from P4-02.
2. Verify critic model is different from translator and every critique is bound to the actual translation hash.
3. For every failed critique, examine meaning/back-translation, clue accuracy and equivalent answer. Re-generate/re-critique rather than weakening the gate.
4. Check normalisation, grapheme length, answer leakage, duplicates, forbidden content and category/difficulty balance.
5. Review language/script samples manually without claiming the entire corpus was human-reviewed.
6. Run:

```sh
pnpm --dir firebase-functions race:translations:audit
```

7. Confirm the manifest says valid and exactly 15 times the final source question count, with 15 bundles and source/bundle SHA-256 values.
8. If using alternate approved paths, pass `--source` and `--input-dir` to the existing audit; record the actual paths and source hash.
9. Save structural manifest, independent-critique results, reviewer notes and all remaining rejections.
10. A matrix audit verifies structural contracts; combine it with semantic critique rather than treating one as a substitute for the other.

**Done when:** The complete corpus passes all gates with no unresolved rejection and preserved provenance.

## P4-04 — [ ] Import complete bundles with honest machine provenance

**Who:** Developer and authorised cloud/content operator. **Before:** P4-02 and P4-03 complete.

1. Confirm bundle/source hashes match the saved audit manifest.
2. Confirm provenance/quality version is `automated_translation_v1`. Do not mark output human-reviewed.
3. Use a private absolute backup folder and authenticated operator access to the explicit target project.
4. For each locale, preview the import. Replace `LOCALE` with that file's real code; the package command runs from `firebase-functions`:

```sh
pnpm --dir firebase-functions race:translations:import --project riddle-quest-ec2b2 --input content/race-translations/race-LOCALE-automated-translation-v1.json
```

5. Review category counts, target writes, existing eligible records, retired paths and collisions. Require 180 correct records per locale and a collision-free plan.
6. If source differs from the default, supply the exact audited `--source` to both preview and apply.
7. Obtain the reviewed import authorisation naming locale, source hash, bundle hash, target project and retirement plan.
8. Run the same command with `--apply --confirm-project riddle-quest-ec2b2 --backup-dir` followed by your real private absolute backup path.
9. Add `--replace-existing` only if the previewed retirement is deliberately approved. It is not a general retry switch.
10. Confirm backup creation and successful transaction. A concurrent-change failure means re-preview, not bypass version checks.
11. Read back approved aggregate count/provenance metadata; verify the correct eligible pools and no false human-review label.
12. Repeat for all 16 bundles and save one result per locale.
13. Rebuild all six target artifacts after content/source changes before release.

**Done when:** All complete bundles are imported from audited bytes with correct provenance, private backups and verified counts.

## P4-05 — [ ] Test physical keyboards, scripts and accessibility

**Who:** Tester and developer.

1. Prepare Latin, Arabic, Cyrillic, Devanagari, Japanese, Korean and Chinese input samples with known expected graphemes.
2. On a real iPhone/iPad, switch the OS keyboard to each relevant language.
3. Open a disposable race and type a sample through normal composition.
4. Confirm composing text is not submitted twice when committed.
5. Paste a multi-character sample, backspace once and submit. Confirm one visible grapheme is deleted and revealed slots stay intact.
6. Attempt text longer than the available answer slots. Confirm it does not overwrite completed/revealed characters.
7. Test Arabic right-to-left direction, mixed text and font shaping.
8. Test accessible focus, touch hit targets, text zoom and keyboard covering the game.
9. Repeat on a physical Android device and desktop keyboard where relevant.
10. Save device/keyboard/OS version, expected string, observed behaviour and redacted recording for each script.
11. Run the injected composition regression tests after any fix, then repeat affected physical cases.

**Done when:** Actual device input works across all required scripts and fonts, with accessible focus and correct editing.

## P4-06 — [ ] Verify every cross-language social entry is rejected safely

**Who:** Two testers and developer.

1. Set tester A to one locale and tester B to another.
2. Have A create a normal race invite; let B open it.
3. Confirm B receives translated incompatibility guidance, keeps their chosen language and does not create a run.
4. Repeat through native share, existing context, matchmaking, rematch and tournament invitation.
5. Have the developer verify no cross-locale board/run/tournament or reward mutation is committed.
6. Repeat with expired and malformed invitations.
7. Set both to the same locale and verify the normal compatible journey still works.
8. Repeat important incoming-link cases on web, iOS and Android and save the results.

**Done when:** Every incompatible entry fails safely and compatible social play still works.

## P5-01 — [ ] Verify all six coin packs and finish payout setup

**Who:** Owner for financial forms; developer for catalog/grants.

1. Open Meta → this app → Game Payments. The seven products already exist; inspect them before creating anything.
2. Open Set up payout. The walkthrough last recorded United Kingdom → Private corporation, step 2 of 5; recheck the live form rather than assuming that position persisted.
3. Have the owner confirm legal entity and tax-correspondence address. The previous address-entry attempt was rejected pending direct owner confirmation.
4. The owner enters requested tax/bank information and certification directly into Meta. If a field is unclear, use Meta's field guidance or the accountant; do not guess.
5. Save only a redacted completion/status reference.
6. Confirm the account is valid for this app/country/entity and resolve every pending error.
7. Have the developer open `packages/core/src/pricing/facebookCatalog.ts` and its shared pricing source.
8. Compare all six exact product IDs and consumable kinds against Meta. Verify grants are 250, 550, 900, 1,600, 3,400 and 7,000 coins.
9. Compare base price/currency with the approved source and live Meta catalog; record any localisation difference. Provider presentation must not decide coin quantity.
10. Verify Meta's current test-payment mode and authorised testers before any transaction.
11. Complete P0-06/P5-03's real signed verification, then test each pack once in the approved environment.
12. Compare balances before/after with server-confirmed grants. Record any debt repayment separately from visible coin increase.
13. Cancel a purchase and fail a purchase; verify neither grants coins.
14. Record all six product tests and payout eligibility.
15. The recorded IAP panel requires a production bundle/payment account. Have the release owner reconcile this review sequencing with Meta before any promotion; do not promote incomplete code to satisfy the form.

**Done when:** Payout eligibility, exact catalog mapping and authenticated hosted purchase evidence exist for all six packs.

## P5-02 — [ ] Verify the durable Remove Interstitial Ads purchase

**Who:** Developer and tester. **Before:** Verified commerce under P5-03.

1. Inspect the existing product `com.roobsworld.riddlequest.remove_interstitial_ads`.
2. Confirm the approved US base price is $4.99 and kind is Non-consumable; no subscription belongs in this Facebook catalog.
3. Test purchase through the approved Meta test environment.
4. Confirm the server records the durable entitlement only after signed verification.
5. Reach a result where an interstitial would normally be eligible. Verify it is suppressed.
6. Reload and repeat; then open another permitted device/session and verify restoration from authoritative state.
7. Confirm this purchase grants the entitlement, not invented coin value or a recurring charge.
8. Cancel or fail the purchase and verify entitlement is absent.
9. Refund through the approved test mechanism and verify entitlement revocation under P5-04.
10. Confirm restored/refunded state remains correct after startup recovery.
11. Build/audit the other targets and confirm the Facebook product/purchase path does not appear there.

**Done when:** Purchase, restoration and refund revocation work and no subscription is introduced.

## P5-03 — [ ] Implement signed purchase/refund boundaries and wire recovery

**Who:** Developer. **Status:** Staged ledger/recovery tests exist; real contract and runtime activation are unfinished.

**New documentation finding:** The current [IAP guide](https://developers.facebook.com/documentation/games/monetize/in-app-purchases) and [v8 Payments reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments) differ in their listed signed claims and grant/consume advice. The tutorial mentions `player_id`; the reference's listed signed-purchase fields do not. Do not add a verifier that assumes an undocumented player binding. Obtain the actual contract/private fixtures, reconcile the discrepancy with Meta, and preserve durable grant-before-consume recovery.

1. Complete P0-06 purchase/unconsumed/refund contract capture.
2. Document exact signed fields, algorithm/key source, raw bytes required, app/player binding, product identifier, token/transaction scope, issue time and event replay identity.
3. If Meta cannot establish any required field/verification contract, leave commerce disabled and record the exact missing authority.
4. Implement verification in server-only code. Client-reported amount, product, player or “success” must not grant value.
5. Resolve the signed product through the server allowlist.
6. Bind verification to authenticated provider/account generation and deletion guard.
7. Pass only a verified internal object into the existing transactional ledger.
8. Record the durable grant before consuming the Meta purchase. A failed/invalid verification must never consume.
9. Implement refund/webhook authentication using Meta's actual documented signature/raw-body contract; do not guess an endpoint or algorithm.
10. Wire startup/resume unconsumed-purchase recovery through the verifier and existing single-flight/dialog barriers.
11. Add tests for wrong app/player/product, altered bytes, unexpected claims, missing signature, duplicate delivery, concurrent grants and deletion during processing.
12. Interrupt after grant but before consume; verify retry grants once and consumes after durable grant.
13. Simulate failed consume and repeated resume/startup recovery; confirm token races cannot create duplicate grants.
14. Run `pnpm test:functions`, `pnpm test:web` and `pnpm check:facebook-commerce-activation`. Any deliberate activation requires updating the audit's authority conditions alongside verified implementation; do not simply remove the guard.
15. Build and deploy the reviewed server/client changes under O-03/P6-01.
16. Repeat the signed end-to-end cases with real Meta test purchases for all products and retain only sanitised results.

**Done when:** Real provider verification precedes every grant/refund, consume ordering is correct and recovery works without duplicate awards.

## P5-04 — [ ] Accept refunds, debt repayment and entitlement revocation

**Who:** Developer and tester. **Before:** Actual verified refund adapter under P5-03.

1. Use the approved test-refund method for each of the six consumables and the durable product.
2. Buy a test pack and refund it before spending. Confirm available balance is reduced once.
3. Buy another test pack, spend part and refund. Confirm remaining grant is removed and spent portion becomes hidden debt.
4. Spend the entire test grant and refund. Confirm hidden debt equals the refunded amount without exposing a negative spendable balance.
5. Make a new verified grant. Confirm it repays debt first and exposes only the remainder.
6. Deliver the same refund again; confirm balance, debt and entitlement do not change twice.
7. Test duplicate/concurrent webhook delivery and event aliases against immutable purchase scope.
8. Test wrong app/player/product, wrong purchase reference, corrupted event and time ordering. Confirm rejection.
9. Refund the durable ad-removal product and verify suppression is revoked.
10. Delete a disposable account and retry an old event; verify tombstone/replay rules cannot recreate identity or old economy.
11. Repeat the all-seven matrix and save balance/debt/entitlement outcomes without raw payment data.

**Done when:** Actual provider refunds match the tested ledger's idempotent accounting and restore/revoke correctly.

## P5-05 — [ ] Finish rewarded extra-try setup; keep coin rewards separately gated

**Who:** Owner, developer, cloud operator and device testers. **Status:** Extra-try implementation and injected Facebook checks passed locally; backend rollout, provider approval/fill and real-device acceptance remain outstanding. The earlier tracker title referred to coin rewards; the owner's 2 October request adds an extra-try reward, not a coin reward. Do not mark the original coin-grant requirement complete without recording its omission or verified implementation.

**What the player gets:** After five wrong guesses in Classic or Daily, choose **Watch a video for an extra try**, or **Use 100 Coins to Try Again**. Either choice buys the same single sixth guess. Watching does not add coins. A race does not use this offer. See [implementation and verification evidence](evidence/facebook-rewarded-continue-2026-10-02.md).

1. Claim the portion you will perform in the progress register below. Write your name and whether you are checking Meta settings, deploying the backend, uploading a Testing draft or testing a device. Read the latest row before acting so two people do not deploy/upload simultaneously.
2. Open [Meta for Developers](https://developers.facebook.com/apps/) and select the existing Riddle Quest Instant Games app. Check its app ID against the repository's Facebook configuration. Do not select an old native/mobile app just because its name looks similar.
3. Open the app's Instant Games monetization settings or the linked Monetization Manager. Menu names can change; use the app's official in-dashboard monetization link if the label differs. Find the existing rewarded-video placement `1748953042991569_1765482768005263` before creating anything. This is the configured Instant Games placement; a native app's ad setup does not automatically carry over.
4. Check that the placement belongs to this app, is a rewarded-video placement, has the necessary approved monetization/property settings and is allowed to serve on the intended Instant Games surfaces. Record its actual approval/status. If you cannot see it, ask the app/property administrator for access; do not make a duplicate placement to work around missing access.
5. If Meta requires a replacement placement, have the administrator create/approve it through the current Instant Games process. Copy its placement ID, not an app secret or access token. Ask the developer to put only that public ID into `VITE_FACEBOOK_REWARDED_PLACEMENT_ID` in `config/vite/portal/.env.facebook`, then rebuild. Never put Meta secrets into a Vite variable.
6. Read [Meta's HTML5 rewarded-ad instructions](https://developers.facebook.com/documentation/games/monetize/in-app-ads/rewarded-ads). Use their approved test-ad/account instructions for this property. Do not click your own live ads or manufacture production traffic. Record whether this app/placement actually receives a successful test impression; a configured ID alone is not proof of fill.
7. Owner: record the trust decision before enabling the feature. The browser waits for Meta's `showAsync()` success, but that success is not a signed receipt the server can verify. The server limits the reward to one exhausted, authenticated Facebook session; a modified authenticated client could still call the extra-try endpoint without watching. Decide whether this bounded SDK-mediated reward is acceptable. If not, keep `rewarded_ads` disabled and request an applicable server-verifiable contract from Meta. Do not borrow a native Android/Unity verification contract for this HTML5 game.
8. Developer: confirm the local implementation still calls `getRewardedVideoAsync`, loads the ad and waits for `showAsync()` success before calling `grantFacebookRewardedContinue`. Confirm failed, cancelled and no-fill results do not call that endpoint. The implementation exists; inspect it rather than building a second ad flow.
9. Confirm the endpoint requires Facebook authentication, App Check, a matching unexpired single-player session and all five confirmed wrong guesses. Confirm it shares the existing one-continue limit with paid continuation and enforces account deletion plus the `rewarded_ads` server switch. Do not add a browser-supplied amount, identity or funding selector to the paid endpoint.
10. From the repository root, run `pnpm check:types`, `pnpm check:facebook-copy`, `pnpm check:facebook-secrets` and `pnpm check:facebook-commerce-activation`, one command at a time. Stop and record any failure. The new button text is already translated in all 16 supported locales.
11. Run `pnpm --filter @riddle-quest/portal test`, `pnpm --filter @riddle-quest/portal test:facebook:playwright`, `pnpm --dir firebase-functions test:deploy-scripts` and `pnpm verify:functions:node22`. Save results without tokens. The browser command uses injected ads, not real impressions, so it cannot complete steps 3–6 or the real-device checks.
12. Run `pnpm build:jest`, `pnpm build:facebook`, `pnpm build:reddit`, `pnpm build:youtube`, `pnpm build:netflix` and `pnpm build:yahoo`. Confirm each isolation audit passes. Facebook ad code/buttons must not become part of another target's artifact.
13. Cloud operator: read O-03 and inspect the latest source/configuration changes with their owners. Include the new `grantFacebookRewardedContinue` export in the reviewed full Functions deployment unit. The export audit now expects 23 Facebook entry points. Do not publish a selectively forced, mismatched backend or deploy another person's unreviewed changes.
14. Deploy the reviewed backend using O-03 while `rewarded_ads` is still disabled. Verify the new endpoint exists and disabled claims fail without altering the balance or attempt count. Record deployed source/configuration revisions. Local tests are not evidence that this endpoint is already deployed.
15. Only after the owner accepts step 7 and the backend/provider setup is ready, claim and approve a configuration rollout. Remove only `rewarded_ads` from the reviewed `FACEBOOK_DISABLED_FEATURES` list, preserve all other entries and follow O-03's validated deployment procedure. Do not enable commerce, notifications or any other feature as a side effect. Do not tick this task simply for changing a flag.
16. Developer: confirm the candidate's configured audience is 13+, the rewarded SDK API is advertised, the placement ID is present and authenticated startup configuration enables rewarded ads. Unknown/ineligible audience, missing API/ID, disabled flag or configuration failure must hide the option. Use injected cases for these checks; do not falsify a real child's age/account.
17. Prepare the clean immutable Testing package under P6-01. Owner: upload only that package under P6-06, record its hash and use an authorized app-role tester. This is a non-public Testing draft; do not promote/publicly launch it as part of ad testing.
18. Close old Facebook game tabs and reopen the Testing draft so the new startup configuration loads. Confirm the draft/backend revisions match the evidence register. An old tab can retain the previous feature projection.
19. On a disposable test account, open Classic and submit five wrong answers. Wait for the fifth answer's server confirmation. Confirm the loss window shows both video and 100-coin choices. Repeat in Daily. Do not use a race to test this offer.
20. Check a balance below 100 coins, including zero. Confirm the video choice remains usable when enabled and the paid choice cannot spend unavailable coins. Then check an account with at least 100 coins; confirm the paid choice is usable. Use developer-controlled test fixtures/approved test accounts rather than changing real customer balances.
21. Record the starting coin balance and attempt count. Choose the video option. While the ad or its server claim is pending, try the coin button, Skip, close button, outside click and Escape. Confirm they cannot spend coins, dismiss the pending flow or start a second ad. Do not click a test advertisement's destination to simulate completion.
22. Complete the approved test video normally. Confirm the game returns to the same riddle with exactly one extra guess, the coin balance is unchanged and the server records `continueFunding=facebook-rewarded`. Submit the extra guess. If it is wrong, confirm there is no seventh guess and no second rewarded/paid continue for that session.
23. On a new exhausted test session, choose the 100-coin option instead. Confirm exactly 100 coins are deducted, one extra guess is granted and video/coin choices cannot then stack into another extra guess. Repeat the race between both requests in the developer harness/transaction tests, not with uncontrolled live ad traffic.
24. On another session, open a test ad then close/cancel it before successful completion using the provider's permitted test path. Confirm there is no claim, no extra try and no charge. The loss window must remain usable so the player can choose coins or leave.
25. Use the provider's permitted no-fill test setting, or the injected harness if Meta does not offer one. Confirm unavailable inventory/load/display failures do not grant a try or charge coins. Record whether the real device case was available; an injected no-fill result is not proof of live fill.
26. Developer: inject a temporary failed server response after successful video completion. Confirm Retry uses the same request ID, does not play another video and can only grant once. Restore connectivity and confirm the modal closes only after the successful server response. These retries are held in memory; a full page reload does not retain proof of the earlier watched video. Record that limitation; never turn a saved browser boolean into trusted ad proof.
27. Reload after a successful extra-try grant, then resume the same authoritative session. Confirm the original continue remains consumed and the player cannot gain another try. Also test an expired session, wrong riddle/token, another account and a deletion-in-progress account; each must reject the claim without recreating progress.
28. Check a second tab/device making a competing paid/video claim for the same exhausted session. Confirm the authoritative transaction grants only one continue. SDK success in two tabs must not create two extra guesses or coin rewards.
29. Verify native-dialog exclusion and pause/resume: while another provider dialog is open, the game must not launch an overlapping ad. Complete a rewarded video, then confirm the existing interstitial policy suppresses an immediate interstitial for 90 seconds. Check input/audio recovery on the actual device.
30. Repeat steps 18–29 on Facebook web, iOS and Android wherever Meta actually supports this app's rewarded ads. Record device, OS/browser, app version, candidate hash, result and sanitized screenshots. A phone-sized injected browser test is helpful but is not an iOS/Android provider test.
31. Test the emergency off switch through P6-03: disable `rewarded_ads`, redeploy validated configuration and restart the game. Confirm the button disappears. Confirm an already-running client's server claim is rejected once the deployed switch is off. Decide how support handles an ad already completed during emergency shutdown; do not claim that a disabled endpoint will still pay out.
32. Leave the feature disabled if approval, fill, owner acceptance or backend/hosted checks fail. Record the failure and next owner/action in this register. If accepted, attach all evidence and release the claim to the release owner. Final public promotion still needs the separate release sign-off.
33. Keep the old 50-coin/five-per-UTC-day proposal out of this extra-try flow. If coin rewards remain in launch scope, ask Meta for an applicable signed receipt/callback; capture a private authentic sample under P0-06; verify app/player/placement/expiry/replay binding server-side; implement idempotent grants and the daily cap; test forged/replayed/concurrent/deleted-account claims; and separately obtain hosted/device acceptance. Until then record coin rewards as omitted/blocked, with no coin promise or grant exposed. `showAsync()` alone cannot satisfy that requirement.

**Done when:** The owner explicitly accepts the bounded extra-try trust model, the reviewed backend and immutable draft are deployed, approved real ads restore exactly one try without charging/minting coins, the paid alternative and failure/device/switch checks pass, and the earlier coin-reward proposal is explicitly omitted or independently verified. Local implementation alone does not complete this task.

## P5-06 — [ ] Accept interstitial placement, no-fill and frequency rules

**Who:** Developer and testers.

1. Inspect existing Audience Network placements and app association. Do not create duplicate placements.
2. Record their actual approval/fill status; Requesting ads is not evidence of successful impressions.
3. Use Meta-approved test ads/settings to avoid testing invalid live clicks or traffic.
4. Start the game and play actively. Confirm no interstitial opens during loading/onboarding/active play.
5. Finish an authoritative solo game; observe eligible result-only display.
6. Finish a race; verify the same placement policy.
7. Trigger another eligible result before 90 seconds have elapsed since successful completion. Confirm no display.
8. Repeat enough approved test cases to reach the ten-per-session limit; verify the eleventh cannot show.
9. Test no-fill, load failure, failed/cancelled display, clock anomaly and overlapping native dialog using the developer harness.
10. Confirm failed/no-fill displays do not falsely count as successful impressions and unsafe bookkeeping suppresses further session ads.
11. Test ad-free entitlement, unknown age/category, absent SDK API and server switch; each must suppress its respective display path.
12. Restart active sessions after switch changes because interstitial availability is startup-projected.
13. Repeat hosted display/no-fill/cancellation on web/iOS/Android and record actual support.

**Done when:** Real-host results respect timing/session/entitlement gates and no unsupported surface blocks core play.

## P5-07 — [ ] Backfill referral retention and accept real invitation retries

**Who:** Cloud operator, developer and testers.

1. Confirm reviewed server code preserves lifetime binding windows before temporary tokens are deleted.
2. Preview one page:

```sh
pnpm --dir firebase-functions facebook:referrals:retention --project riddle-quest-ec2b2 --page-size 100
```

3. Inspect `invalid`, `tooManyBindings`, `bindingUpdates` and `nextTokenCursor`. Invalid/oversized rows remain a blocker.
4. After maintenance review, run the same page with `--apply --confirm-project riddle-quest-ec2b2`.
5. For later pages, add `--after` with the exact previous cursor. Save every preview/apply result and continue through the full set.
6. Enable/deploy `facebookReferralTokens.expiresAt` TTL only after dependent legacy bindings are safe; coordinate the full indexes release with O-03.
7. Share an invitation from A and open it as a genuinely new eligible test account B.
8. Confirm one lifetime referrer binding. Opening the share dialog alone must award nothing.
9. Test self-referral, established player, expired token, another referrer and replay through emulator/authorised disposable accounts.
10. Complete an authoritative solo or race first win. Verify the implemented reward settlement and daily inviter cap without repeatedly crediting replay.
11. Observe an expired disposable token physically disappear under TTL.
12. Retry a matching already-bound invitation after token cleanup; verify the original binding/window remains valid for idempotent handling without rebinding or new reward.
13. Test account deletion and save real share/open/device evidence.

**Done when:** Backfill, TTL removal and hosted retry behaviour all preserve lifetime binding/idempotency.

## P5-09 — [ ] Accept the native notification opt-in prompt

**Who:** Developer and tester.

1. Deploy the reviewed configuration/prompt Functions; the 1 October live versions still disabled notifications even though local source allowed testing.
2. Confirm the native bot-subscription methods are advertised on the actual host.
3. On a new eligible test account, submit a wrong answer. Confirm no opt-in prompt appears.
4. Complete an authoritative first solo win. Confirm prompt eligibility is checked and the native dialog opens only when allowed.
5. Accept; confirm the SDK reports subscription and server records acceptance before any result ad.
6. Reload and verify acceptance does not prompt again.
7. Repeat with denial/cancellation on another test account. Verify the server's seven-day retry rule.
8. Test the waiting interval with an isolated developer clock/test fixture, not by editing production time.
9. Test unsupported API, config-read failure, disabled switch and overlapping provider dialog. Core play must remain usable.
10. Repeat a first race win and all supported web/iOS/Android opt-in paths.
11. Record subscription evidence separately from scheduling/delivery.

**Done when:** Real prompts obey eligibility/consent/retry rules and acceptance is preserved.

## P5-10 — [ ] Establish and implement reminder scheduling/cancellation

**Who:** Developer and Meta account owner. **Status:** Blocked pending app-specific API/permission/fixture acceptance, not because no scheduling guide exists.

1. Read Meta's current [Notification Service guide](https://developers.facebook.com/documentation/games/retain/notifications/notification-service), [notifications overview](https://developers.facebook.com/documentation/games/retain/notifications/overview) and [A2U guide](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api). The managed-service guide describes SDK scheduling/cancellation; A2U is a separate server-driven channel. Record which channel the app is actually approved to use.
2. Open the app's notification/template configuration. Capture the enabled service and permissions. In an authorised hosted test, inspect the actual SDK and `getSupportedAPIs()` result; do not assume every method shown in a guide exists in the app's v8 runtime.
3. Obtain the exact app-specific schedule, identifier, replacement and cancellation contract for D1/D3/D7 reminders and race alerts. Record template approval, limits, locale/copy rules, deep-link format and how server-side deletion cancels pending managed messages when the client is absent.
4. Do not treat `subscribeBotAsync` as a scheduling API.
5. If the contract is unavailable, keep reminders disabled, document the provider blocker and agree a release without scheduled reminders if appropriate.
6. If available, capture approved private request/response fixtures and implement the Facebook adapter for that exact channel. Use managed scheduling only when accepted for this app, or a server-side scheduler for a verified A2U contract. Do not replace it with browser timers or claim the bot opt-in prompt sends reminders.
7. Limit each player's active scheduled set to five items and ensure active completion replaces obsolete reminders.
8. Enforce consent, unsubscribe/block/deletion cancellation and idempotent event delivery.
9. Verify templates/copy against every required locale and provider length rule.
10. Test failures, retries, duplicates, replacement, revocation and expired/deleted deep-link targets.
11. Complete P0-05's actual delivery matrix.
12. Save provider approval and delivery evidence before enabling public sends.

**Done when:** The contract, implementation, templates and actual replacement/cancellation/delivery are accepted, or reminders are explicitly omitted from release scope.

## P5-11 — [ ] Verify feature/age/API gates and dialog exclusion

**Who:** Developer and tester.

1. Make a feature matrix for identity, commerce, rewarded ads, interstitials, referrals, notifications, matchmaking, tournaments and presence.
2. For each optional capability, test Enabled with supported API, Disabled, Missing API, Unknown age/configuration and Config-read failure.
3. Use developer-controlled harnesses for unknown-age and missing-API simulations; do not change a live player's age/account facts.
4. Verify each failure hides only the affected optional feature and preserves safe core play.
5. Keep commerce and rewarded grants unexposed until P5-03/P5-05 establish authority.
6. Open native context selection; try ad, notification, share and tournament actions while it is pending.
7. Confirm the SDK-instance guard prevents a second provider dialog.
8. Repeat with success, cancellation and error; confirm the guard releases only after the operation settles.
9. Repeat with native matchmaking and tournament sharing.
10. Verify pause/resume while a native dialog is open and repeat on web/iOS/Android.
11. Test a changed startup-projected switch after restart and record the before/after server revision.

**Done when:** Capabilities fail safely and native dialogs never overlap in the supported host matrix.

## P6-01 — [ ] Produce a clean, audited, immutable testing handoff

**Who:** Developer and release operator. **Status:** Tooling exists; clean-source/current handoff remains outstanding.

**Local progress:** Initial six isolated target builds, Facebook browser smoke, backend preflight, Node 22 tests and emulator rules passed on the shared dirty workspace. Browser fixture repairs passed focused checks. The 00:17 UTC Daily-calendar compile failure was subsequently resolved in the shared source; six builds and the expanded Facebook rewarded-continue harness passed later in this turn. Wider browser/content gates, clean-source agreement and immutable candidate/upload are still separate outstanding work. See the [dated verification report](evidence/facebook-launch-verification-2026-10-02.md) and [rewarded-continue evidence](evidence/facebook-rewarded-continue-2026-10-02.md). Treat these as completed diagnostic substeps, not a frozen release certification.

1. Finish the reviewed content and code changes for the candidate.
2. Run `git status --short`. If other people have edits, coordinate them; do not discard, stash or commit their work blindly.
3. Agree a clean reviewed release checkout/commit. Include this checklist/evidence updates deliberately before packaging.
4. Run `git rev-parse HEAD` and record the source commit.
5. Run the baseline checks one command at a time:

```sh
pnpm check:security
pnpm check:facebook-secrets
pnpm check:facebook-profile-boundary
pnpm check:facebook-commerce-activation
pnpm check:facebook-copy
pnpm check:types
pnpm --filter @riddle-quest/portal check:locales
pnpm --filter @riddle-quest/portal check:licenses
pnpm --filter @riddle-quest/portal test:release-scripts
```

6. Build every required isolated target; complete release content must pass its own gates:

```sh
pnpm build:jest
pnpm build:facebook
pnpm build:reddit
pnpm build:youtube
pnpm build:netflix
pnpm build:yahoo
```

7. A content fixture build is not a passing production build. Record any incomplete-content failure and resolve it before claiming all six release artifacts pass.
8. Run `pnpm check:target-boundaries` and inspect each artifact audit. Ads remain Facebook-only; Reddit remains same-origin; YouTube/Netflix/Yahoo stay self-contained.
9. Run relevant unit/backend/rules checks:

```sh
pnpm test
pnpm test:functions
pnpm --dir firebase-functions test:race:rules
```

10. Run injected browser verification against existing builds:

```sh
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @riddle-quest/portal test:facebook:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @riddle-quest/portal test:jest-local:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @riddle-quest/portal test:reddit:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @riddle-quest/portal test:youtube:playwright
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @riddle-quest/portal test:standalone:playwright
```

11. Verify Facebook critical initial resources are below 5 MiB and total below 200 MiB, root configuration is present and private credentials/source maps/symlinks are absent.
12. Once the backend and clean-source gates pass, run the canonical local handoff command:

```sh
pnpm release:facebook
```

13. This rebuilds/preflights and runs `facebook:draft begin`. It prints the private immutable snapshot path and fingerprint; it does not upload to Meta.
14. Upload only that printed immutable snapshot. Package preflight alone creates a rebuildable ZIP and is not the same handoff.
15. Save SHA-256, bytes, entry count, commit, output and receipt path. Keep receipts under the ignored private receipt directory.
16. If the command reports unresolved attempt/lock/dirty source, follow its reconciliation process. Do not delete receipts or steal locks to make it pass.

**Done when:** All required checks pass and a clean source commit is bound to an immutable candidate snapshot. Hosted acceptance is still separate.

## P6-03 — [ ] Exercise every deployed emergency switch

**Who:** Developer and authorised release/cloud operator.

1. Arrange a controlled test window; use test traffic and preserve unrelated provider service.
2. Record current deployed `FACEBOOK_DISABLED_FEATURES`, backend revision and an incident/test identifier.
3. Test one capability at a time. Retain all already-disabled names and add only the tested name.
4. Deploy the reviewed configuration through O-03's environment/deployment workflow.
5. For identity, verify nonce issue/exchange refuse operation.
6. For commerce/referrals/matchmaking/tournaments, verify implemented server mutations refuse operation, not just hidden buttons.
7. For notifications, verify eligibility/acceptance refuse mutation and scheduling is suppressed/cancelled by the implemented contract if enabled.
8. For presence, keep a listener open and verify revocation plus rejection of new connection writes; check opt-out cleanup still works.
9. For interstitials, close/reload active sessions and verify no new SDK requests. Existing tabs do not poll this startup projection.
10. For rewarded grants, exercise the verified server boundary if implemented; otherwise retain disabled status and record that no authority exists.
11. After each test, verify unaffected Facebook capabilities and Jest core play still work.
12. Restore only that test's changed switch after validation and reviewer approval. Record old/new values and deployed revisions.
13. Save the procedure the on-call operator will use during an actual incident.

**Done when:** Every shipped capability can be disabled with verified effects and a documented session-restart/cleanup limitation.

## P6-06 — [ ] Upload a Testing draft, complete reviews and promote approved bytes

**Who:** Release operator and owner. **Before testing upload:** Backend preflight/rollout and clean immutable package. **Before promotion:** Complete acceptance, required reviews and final owner approval.

1. Open Meta apps → App ID `1748953042991569` → Instant Games → Web hosting, or the equivalent current hosting panel.
2. Inspect the existing version list and locally retained upload receipts. Version 4 is already Testing according to saved evidence; reconcile old attempts before creating a new one.
3. After P6-01, choose the upload/new-version action and select only the immutable snapshot printed by `pnpm release:facebook`.
4. Add a non-secret version note naming the source commit and ZIP hash.
5. Wait for Meta's scan. Keep it a role-account Testing draft and record version/bundle ID and outcome.
6. If outcome is unknown, stop retransmission. Record the ambiguity using the actual hash:

```sh
pnpm --dir packages/portal facebook:draft ambiguous --archive-hash EXACT_64_HEX_SHA256 --reason "dashboard result unknown after transmission"
```

7. Reconcile the full Meta version list and original attempt before any retry. If local creation was interrupted, have the operator use the documented `recover --archive-hash` procedure; recovery never authorises transmission by itself.
8. Download the stored candidate ZIP through the dashboard, when available, and run:

```sh
sha256sum /absolute/path/to/downloaded-candidate.zip
```

9. Replace that example with the real path. Compare with the immutable local snapshot hash; a version comment alone is not independent proof. If the bytes cannot be obtained/verified, leave exact-byte acceptance blocked.
10. Save a redacted draft dashboard evidence file privately and bind acceptance using real values:

```sh
pnpm --dir packages/portal facebook:draft accept --archive-hash EXACT_64_HEX_SHA256 --draft-id META_DRAFT_ID --evidence /absolute/path/to/redacted-draft-evidence
```

11. Complete P0-04 and every included feature procedure against this exact draft. If code changes, make a new reviewed candidate and revalidate its bytes.
12. Finish Partner, policy, quality, listing/IARC, payments and app review prerequisites shown by the actual dashboard.
13. For each review, provide truthful test instructions, a role-account route, supported devices, feature state and sanitised evidence. Record reference/status and resolve reviewer failures.
14. Resolve the IAP review/production-bundle sequencing with Meta and the release owner. Do not bypass the repository's final-publication boundary to satisfy a dashboard prerequisite.
15. Ask the owner for final written approval naming exact version/hash, enabled features and public promotion action.
16. Use Meta's current promote/publish action for that same accepted draft. Do not upload freshly rebuilt bytes during promotion.
17. Download/independently verify the production ZIP hash. Confirm it equals the accepted draft.
18. Record the real promotion only after it occurs:

```sh
pnpm --dir packages/portal facebook:draft promote --archive-hash EXACT_64_HEX_SHA256 --production-hash EXACT_64_HEX_SHA256 --evidence /absolute/path/to/redacted-promotion-evidence
```

19. Keep promotion/upload receipts private and write-once. A local receipt confirms local consistency; it does not itself perform or prove Meta promotion.
20. If production hash differs, stop the launch, preserve evidence and use the reviewed incident/rollback path.

**Done when:** Actual review approval, owner approval, draft acceptance and matching production bytes are all recorded.

## P6-07 — [ ] Validate public play and operate the launch window

**Who:** Release operator, testers and named support/on-call owner.

1. Before promotion, agree the staffed observation window, review times, escalation contact and rollback decision criteria. Record explicit values chosen for this release.
2. After promotion, open the published game with a consenting account that has no developer/test role.
3. Confirm it can load/onboard/play without role access.
4. Complete wrong-answer, correct-answer/results, save/reload, preference and resume journeys.
5. Verify enabled social/race routes with a second non-role consenting tester.
6. Inspect the deletion entry without destroying an ordinary player's account; use a designated disposable account for the full deletion smoke test.
7. Test public monetization only through a deliberately approved purchase/ad test method with the owner aware of any actual charge. Do not fabricate a sandbox purchase on a production-only path.
8. Repeat public startup/core play on supported web/iOS/Android surfaces.
9. Verify the expected production version/hash and backend revisions.
10. Open Cloud Logging and the Cloud Functions metrics for the deployed services.
11. Review request failures, auth/App Check rejection, latency, storage failures, ad/payment faults, deletion/support queue and physical-device issues at the agreed times.
12. Do not label backend requests as players/sessions. No email or Slack alerting is configured.
13. Assign a human to inspect dashboards during this window, or have the owner approve a real alerting implementation. Do not assume an email will arrive.
14. When a feature is unsafe, use P6-03's verified switch procedure. Restart sessions where required, confirm the effect and record incident time/revision.
15. If core safety/identity is broken, follow the approved broader rollback/public-availability response and stop announcing a successful launch.
16. Write a final release report containing version/hash, backend revisions, review references, smoke outcomes, supported surfaces, scope exclusions, incident contacts and recovery steps.
17. Update this checklist and the progress tracker with actual evidence. Keep post-release unresolved work visible.

**Done when:** Non-role play passes, monitoring has an accountable operator and the agreed launch window closes with a recorded result.

## Shared progress: how we avoid doing the same work twice

1. Before starting a task, put your name in its Owner column and set its state to Working.
2. Add a dated note stating exactly what you will do. Claim a narrow portion when a task mixes local/server/device work.
3. Read the latest row immediately before acting, especially for deployments and uploads.
4. If another owner has claimed it, continue a different task or coordinate the handoff in this chat.
5. After an action, record UTC time, result, source/version/hash, evidence link and one precise next action.
6. Use Waiting on owner, Waiting on provider, Waiting on device, Blocked, or Local checks passed when those describe the real state.
7. Use Complete only after the task's acceptance criteria are met. Local checks passed does not mean deployment or hosted acceptance.
8. Preserve previous progress notes; append a correction if a result changes.
9. The task checkbox and tracker must agree with the evidence. Optional omissions must be recorded as scope changes, not fake implementation success.
10. Recheck the document for concurrent edits before saving. Do not overwrite another person's progress.

### Progress register

The statuses below are the tracker snapshot at this review, with later-evidence discrepancies called out in the procedures. “Unassigned” means no exclusive claim; it does not mean nobody has ever worked on the feature.

| Task | Current state | Owner / claimed portion | Next action | Evidence / last result |
| --- | --- | --- | --- | --- |
| P0-01 | In Progress — Business check passes | Owner — Partner action unclaimed | Confirm company details and actual Partner approval | 2 Oct live read: Business verification passes; Partner approval unproved |
| P0-02 | In Progress — live settings gaps found | Owner / second reviewer — action unclaimed | Verify contact email; reconcile support, deletion and domains fields | 2 Oct live read and privacy/terms HTTP 200; see verification report |
| P0-03 | In Progress | Unassigned | Prove secret issuance and repair provider IAM | Existing tracker; no new acceptance claimed |
| P0-04 | Blocked | Unassigned | Run the complete real-host acceptance matrix | Existing tracker; no new acceptance claimed |
| P0-05 | Blocked | Unassigned | Prove notification delivery across all three platforms | Existing tracker; no new acceptance claimed |
| P0-06 | Blocked | Unassigned | Capture provider contracts without publishing reusable credentials | Existing tracker; no new acceptance claimed |
| P2-01 | In Progress — nonce dry-run complete | Cloud operator — backfill unclaimed | Backfill 13 previewed nonces before enabling TTL; prove hosted identity | 2 Oct preview: 13 scanned/ready, 0 invalid; TTL not enabled |
| P2-03 | In Progress | Unassigned | Verify Firebase authentication and App Check refresh | Existing tracker; no new acceptance claimed |
| P2-05 | In Progress | Unassigned | Verify loading, saving, failure recovery and pause/resume | Existing tracker; no new acceptance claimed |
| P3-03 | In Progress — deployed gap confirmed | Cloud operator — deployment unclaimed | Deploy reviewed cleanup scheduler and prove expiry | 2 Oct live inventory: scheduler absent; context dry-run empty |
| P3-04 | In Progress | Unassigned | Accept native tournaments backed by official results | Existing tracker; no new acceptance claimed |
| P3-05 | In Progress | Unassigned | Verify provider-rendered names/photos and overlay disposal | Existing tracker; no new acceptance claimed |
| P3-06 | In Progress | Unassigned | Prove opt-in presence with two tabs and two devices | Existing tracker; no new acceptance claimed |
| P3-07 | In Progress | Unassigned | Prove strangers, blocked rivals and deleted players cannot view presence | Existing tracker; no new acceptance claimed |
| P4-02 | In Progress | Unassigned | Remove overlong-answer questions and finish the supported-language corpus | Existing tracker; no new acceptance claimed |
| P4-03 | In Progress | Unassigned | Audit meaning, Unicode, duplicates and the complete corpus | Existing tracker; no new acceptance claimed |
| P4-04 | In Progress | Unassigned | Import complete bundles with honest machine provenance | Existing tracker; no new acceptance claimed |
| P4-05 | In Progress | Unassigned | Test physical keyboards, scripts and accessibility | Existing tracker; no new acceptance claimed |
| P4-06 | In Progress | Unassigned | Verify every cross-language social entry is rejected safely | Existing tracker; no new acceptance claimed |
| P5-01 | In Progress | Unassigned | Verify all six coin packs and finish payout setup | Existing tracker; no new acceptance claimed |
| P5-02 | In Progress | Unassigned | Verify the durable Remove Interstitial Ads purchase | Existing tracker; no new acceptance claimed |
| P5-03 | Blocked — provider contract reconciliation | Developer — implementation unclaimed | Resolve signed player binding, consume ordering and refund contract | 2 Oct official IAP/Payments documentation discrepancies recorded |
| P5-04 | In Progress | Unassigned | Accept refunds, debt repayment and entitlement revocation | Existing tracker; no new acceptance claimed |
| P5-05 | Local extra-try checks passed; rollout/device acceptance outstanding; coin grants blocked | Codex — implementation complete, claim released; owner/operator/tester portions unclaimed | Approve bounded SDK trust model; verify placement, deploy backend, enable approved Testing configuration and test real devices | 2 Oct: translated loss UI, bounded server grant and injected completion/cancel/no-fill/retry checks; [evidence](evidence/facebook-rewarded-continue-2026-10-02.md); no production switch changed |
| P5-06 | In Progress | Unassigned | Accept interstitial placement, no-fill and frequency rules | Existing tracker; no new acceptance claimed |
| P5-07 | In Progress — retention dry-run complete | Cloud operator / testers — action unclaimed | Recheck scan, enable TTL safely, accept real referrals | 2 Oct scan: 0 records/invalid bindings; token TTL not enabled |
| P5-09 | In Progress | Unassigned | Accept the native notification opt-in prompt | Existing tracker; no new acceptance claimed |
| P5-10 | Blocked — app-specific contract acceptance | Developer / Meta owner — action unclaimed | Validate managed Notification Service vs A2U and real SDK fixtures | 2 Oct official scheduling/cancellation guide found; nothing enabled |
| P5-11 | In Progress | Unassigned | Verify feature/age/API gates and dialog exclusion | Existing tracker; no new acceptance claimed |
| P6-01 | Release gate not closed; compile failure subsequently resolved | Codex — local subchecks complete; claim released | Finish wider browser/content gates; agree clean reviewed source and immutable candidate | Later six builds/types/backend/Facebook rewarded browser passed; not a release certification |
| P6-03 | In Progress | Unassigned | Exercise every deployed emergency switch | Existing tracker; no new acceptance claimed |
| P6-06 | Blocked — handoff/review reconciliation | Owner — action unclaimed | Finish P6-01; reconcile contradictory Meta review indicators before submission | 2 Oct: dev mode, not live; requirements refuse submission; history empty |
| P6-07 | Not Started | Unassigned | Validate public play and operate the launch window | Existing tracker; no new acceptance claimed |
| O-01 | Outstanding | Unassigned | Prepare your workspace and evidence record | See procedure |
| O-02 | Outstanding | Unassigned | Decide and record the launch feature scope | See procedure |
| O-03 | Local preflight passed; rollout outstanding | Codex — read-only subchecks complete; claim released | Review dirty source/IAM, backfill, then deploy approved full unit | Node 22 1,430 tests; rules 526; live TTL/scheduler gaps in report |
| O-04 | Outstanding | Unassigned | Finish support, listing and IARC rating | See procedure |
| O-05 | Outstanding | Unassigned | Accept account deletion on real hosts | See procedure |
| O-06 | Outstanding | Unassigned | Finish auditable support/moderation closure and retention | See procedure |

### Work log

- 2026-10-02 — Codex: rewrote instructions to cover all 33 outstanding tracker rows plus operational prerequisites. Reviewed repository scripts, later approval/evidence documents and Firebase guidance. No production action was performed by writing this document.
- 2026-10-02 — Codex: claimed the local build/audit/browser-verification portion of P6-01. Backend deployment, hosted/device evidence and final publication remain separate portions of the tasks.
- 2026-10-02 00:12 UTC — Codex: local audits, six target builds, backend preflight, Node 22 unit verification and 526 emulator-rule tests passed. Facebook/YouTube/candidate browser checks passed. Live Meta/Firebase checks and bounded retention previews completed without writes. Privacy/terms returned HTTP 200. Detailed results and missing settings/TTL/scheduler are in [the verification report](evidence/facebook-launch-verification-2026-10-02.md).
- 2026-10-02 00:12 UTC — Codex: repaired stale onboarding/Classic-only browser fixtures in three focused test files, preserving existing build-directory changes and Daily-first gameplay. Help 1/1 and coin/paid-action 9/9 pass. Wider browser gate remains open; do not duplicate the completed focused repairs. Local verification claim will be released after the current rerun; production and hosted work remain unclaimed.
- 2026-10-02 00:17 UTC — Codex: whole Jest game-browser rerun is now 17 passed / 1 failed. Seeded the long hosted test's Classic pages without changing its dedicated Daily scenario. A fresh rebuild failed before browser execution with TS2353 at `packages/core/src/validation/dailyCalendar.ts:6` (`zh` is not supported). Left that concurrently added runtime file untouched. Current-build verification must be repeated after its author resolves the mismatch; old-build browser checks are diagnostic only.
- 2026-10-02 00:19 UTC — Codex: the old-build long hosted diagnostic now passes its original tour failure and stops at missing Race Debut achievement popup, line 768. Kept the regression assertion intact and recorded the next investigation. The separate Jest authentication run was stopped without claiming a result because current-source compilation is blocked and it was using the earlier artifact. Local verification claim released; no verification/deployment/upload process is intentionally left running. See the report before repeating work.
- 2026-10-02 00:54 UTC — Codex: implemented the owner's Facebook video-or-100-coins loss-screen request. Both choices share one authoritative extra try; video cancellation/no-fill do not charge/grant, pending controls lock and transport retry does not require another watch. New endpoint is Facebook/auth/App Check/deletion/session/switch gated; it does not verify a signed impression receipt or mint coins. Local Node 22 Functions verification passed 1,449 tests; six target builds and injected Facebook browser checks passed. Current shared source now compiles, correcting the earlier Daily-calendar failure. See [rewarded-continue evidence](evidence/facebook-rewarded-continue-2026-10-02.md) for latest rerun results and limitations. No backend deployment, Meta mutation, feature-switch activation or public upload performed. Implementation claim released; rollout and device checks remain unclaimed.
- 2026-10-02 00:58 UTC — Codex: final rerun passed all six isolated builds, 225 client suites / 1,848 tests, Facebook injected browser completion/cancellation/no-fill/retry at 390×844, workspace types and 736 required Facebook translations. Visually checked the phone loss modal; video/coin/Skip choices fit on screen. The earlier concurrent race-test localStorage failure is resolved in its author's latest source. Added 33 numbered P5-05 rollout/acceptance steps and a dedicated evidence report. No release/deployment claim made and no verification process left running.

## Final release sign-off steps

1. Compare every outstanding task with its evidence and current feature scope.
2. Confirm core identity, App Check, deletion, server-authoritative economy and secret protection have no unresolved safety failure.
3. Confirm all advertised optional features have actual provider/device acceptance.
4. Confirm omitted features remain disabled and absent from misleading UI/copy.
5. Confirm complete content and all six isolated artifacts pass required gates.
6. Confirm deployed Functions/rules/configuration revisions match the reviewed release plan.
7. Confirm Meta approval and final owner approval name the tested version/hash.
8. Confirm immutable draft and independently verified production hashes agree.
9. Confirm support/moderation, retention, on-call monitoring and rollback are operational.
10. Have the release owner sign the evidence register. Then record the public-release outcome in P6-07.

## Sources and limits of these instructions

Repository commands were checked against root/package scripts and the backend/operator CLIs. Menu paths are based on the saved authenticated dashboard walkthrough; Meta can change labels. If a panel differs, use the official in-dashboard instructions and record the discrepancy rather than clicking a guessed equivalent.

The legacy [Meta testing/publishing URL](https://developers.facebook.com/docs/games/instant-games/test-publish-share/) and [SDK v8 URL](https://developers.facebook.com/docs/games/instant-games/sdk/fbinstant8.0/) could not be fetched by the web research tool. The authenticated Meta connector subsequently provided current official IAP, Payments and notification documentation, plus read-only app settings/review checks. This does not verify every dashboard label or resolve the contract/review contradictions described above. Check the provider's actual app-specific contract before implementation or activation.

The expiry procedure was checked against [Firebase TTL documentation](https://firebase.google.com/docs/firestore/ttl); temporary deletion is asynchronous and does not cascade through subcollections. Secret/environment handling should follow [Firebase's current environment guidance](https://firebase.google.com/docs/functions/config-env) together with the stricter repository secret audit.
