# Get Riddle Quest working on Facebook

App: [Riddle Quest, 1748953042991569](https://developers.facebook.com/apps/1748953042991569). Updated 24 November 2026.

Follow these steps in order. First get one private build accepted and playable. Then finish saving, permissions, payments, ads and release requirements. Each step states what you should see before continuing.

## What we have checked

The authenticated Meta check on 24 November found:

| Item | Result |
| --- | --- |
| Your account | Admin of Riddle Quest |
| App status | Development mode, not live; no app restriction reported |
| Compliance | No required actions or open violations reported |
| Business verification | Passes the review prerequisite |
| Codex's Meta connection | Read access only; no build-upload tool |
| Privacy and terms | Saved as `https://roobsworld.com/riddle-quest/privacy` and `https://roobsworld.com/riddle-quest/terms` |
| Contact email | `grindheadgames@gmail.com`, reported unverified |
| Zero Permission Access | Not live; API responses conflict about the review state |

The existing `build-facebook.zip` matched its recorded fingerprint and passed the artifact audit. This confirms the local files, not Meta acceptance. Historical version numbers in older documents are not a current dashboard inventory.

## 1. Open Web Hosting

1. Open [the app dashboard](https://developers.facebook.com/apps/1748953042991569).
2. Check that the selected app is **Riddle Quest**, ID **1748953042991569**.
3. Open **Instant Games → Web Hosting**. If your dashboard starts with a **Use cases** list, open the Instant Games configuration first and locate Web Hosting there.
4. Find **Manage Hosted Assets**, the uploaded-version list and **Upload Version**.

You should see the hosting controls for this app. If the page instead names a restriction or required action, record its exact wording before changing anything.

Your admin account can use this page independently of Codex's read-only connection. Granting that connector Manage access would enable its supported management tools, but would not add a bundle-upload tool. See [Meta's MCP scopes](https://developers.facebook.com/documentation/mcp/devtools-mcp).

## 2. Choose how to upload

Use the dashboard for the first private upload if you want the shortest route to a playable build. Use the remote route when you want Codex or the release command to transmit the same prepared ZIP.

### Upload through the dashboard

1. Have the developer prepare the approved candidate and give you the immutable, hash-named ZIP path. A file called `build-facebook.zip` is rebuildable; the release handoff freezes its exact bytes.
2. Click **Upload Version** and select that immutable ZIP.
3. Use a comment containing its SHA-256 fingerprint so you can identify the upload later.
4. Wait for upload processing and scanning to finish. Read any validation error before trying again.
5. Record the version number, bundle ID and final status. If Meta offers a download, have the developer compare it with the original ZIP's fingerprint.

The developer prepares this handoff from clean, reviewed `main` using `pnpm release:facebook:handoff`. It builds and audits the artifact without running local tests or browser harnesses. Gameplay acceptance happens through Meta's Testing version after the upload. An upload needs an explicit request.

### Enable remote uploading

1. On the same Web Hosting page, click **Get Asset Upload Access Token**.
2. Obtain the token using your app admin or developer account.
3. Keep the complete upload-user token in a private local prompt, secret store, or the ignored root `.env` as `FACEBOOK_APP_ACCESS_TOKEN`. Do not paste it into this chat, a committed source file or a command argument. An app token or app secret is not interchangeable with the documented upload-user token.
4. Use the repository's `facebook:draft upload` command after the candidate is prepared and you have explicitly requested the upload. The [operations guide](facebook-instant-games-operations.md#remote-draft-upload-authorization) gives the exact command and private token prompt.

This is a separate credential from the read-only Meta connector. Meta's [upload guide](https://developers.facebook.com/documentation/games/launch/upload-bundle) documents the two-step API and the token button. The repository command verifies the candidate's exact fingerprint, uploads once, and retains a private submission receipt. It still requires a real token and a live upload to establish that it works with this app.

Use one upload route per candidate. If a request times out or its outcome is unclear, inspect the version list before another transmission. The release command deliberately blocks retries until the existing attempt is reconciled.

You can continue when Meta shows that the exact uploaded build has finished processing without a validation error.

## 3. Stage the build for private testing

1. In the uploaded-version list, find the accepted candidate.
2. Use the **beaker / Stage for testing** action for that version.
3. Confirm that the intended version is assigned to **Testing**.
4. Open [the Facebook game link](https://www.facebook.com/gaming/play/1748953042991569/) with your app-role account.
5. For another tester, add their account through the app's role controls and have them accept the invitation before opening the game.

Use the testing action at this stage. The rocket / production action changes the released version and requires separate release authorization. Meta describes the distinction in [uploading and managing versions](https://developers.facebook.com/documentation/games/launch/upload-bundle).

You can continue when the private game opens the intended version and reaches a playable screen.

## 4. Check startup and saving

Work through this with the developer and an approved tester:

1. Open the private game through Facebook and finish onboarding.
2. Play a complete solo round. Note the resulting balance and progress.
3. Reload. Confirm that the acknowledged result remains and that rewards have not been added again.
4. Close and reopen the game. Confirm that it restores the same account and progress.
5. Check background/resume behavior on the supported desktop and phone hosts.
6. Check any enabled race, invitation and sharing features with a second role account.

If startup fails, give the developer the visible error, version and time. The developer must compare the candidate with the deployed backend and inspect blocked requests, the exact Facebook host origin, signed identity exchange and App Check. Earlier startup failures involved an origin allowlist and an app-secret mismatch; that history does not establish the cause of a new failure. Keep credentials out of error reports.

You can continue when the enabled game flows work on Facebook and acknowledged progress survives reopening. A successful upload alone does not establish this.

## 5. Finish contact, privacy and deletion setup

1. Open the app's basic settings and verify `grindheadgames@gmail.com` through Meta's verification flow.
2. Confirm who monitors that inbox for support, privacy and safety requests.
3. Open the saved privacy and terms pages while logged out and check that they describe the actual enabled game.
4. Have the developer inspect the existing data-deletion configuration and deployed callback before changing it. A missing generic MCP field does not prove the dashboard callback is absent.
5. Have the developer verify signed deletion and the behavior of a later new account. Opening the callback in a browser is insufficient.

The existing owner decision is to retain routine resolved support/report records for 90 days after closure, with documented legal or dispute exceptions. See the [approval walkthrough](facebook-approval-walkthrough.md) and [moderation runbook](facebook-moderation-runbook.md).

You can continue when the contact is verified, support ownership is clear and the public information matches accepted deletion and retention behavior.

## 6. Resolve permission and partner requirements

1. Open the app's **App Review / permissions** area and locate **Instant Games Zero Permission Access**.
2. Read its actual status and any rejection or pending-review explanation.
3. Record that result before attempting another submission. Current API responses say both that a prior submission is in review and that there is no submission history. They also report the permission as rejected and not live. These responses are not approval.
4. If the dashboard has the same contradiction, use Meta's developer support route to resolve the existing review state rather than submitting duplicates.
5. Check the **Approved Partner Program** application. Business verification already passes, but it is a different approval. Complete any remaining application accurately.
6. If the application asks for a legacy Apple Team ID that does not apply to this HTML5 game, obtain Meta's guidance. Do not invent an ID or enroll in another platform to fill the field.

The developer supplies review instructions and evidence for the actual enabled features. You review the business information and any declarations. See [Meta's review overview](https://developers.facebook.com/documentation/games/launch/reviews/overview) and [Approved Partner Program](https://developers.facebook.com/documentation/games/launch/approved-partner-program/).

You can continue when each required permission and partner decision has an explicit, recorded result. Private build testing can proceed while these public-release requirements remain open.

## 7. Complete the listing and age rating

1. Review the existing title, description, icon, cover images and screenshots before replacing anything.
2. Describe the features that are actually enabled in the submitted version.
3. Complete IARC and other content questions accurately. Your existing decisions are a **13+ audience** and retaining the game's historical themes.
4. Check the listing's support and privacy links.

You can continue when the dashboard's required listing fields and rating follow-ups are complete and agree with the game being reviewed.

## 8. Complete payments and ads

### Payments

The Facebook purchase and refund implementation is present but remains disabled pending provider acceptance. Follow [Activate Facebook payments](facebook-payments.md) with the developer.

1. Complete payout, tax, bank and certification steps directly in Meta. Confirm the correct legal business details yourself; the old proposed address has not been accepted as current tax-correspondence information.
2. Review the seven existing products: six coin packs and Remove Interstitial Ads. Avoid duplicate registrations.
3. Obtain the required Gaming Profile or Instant Games Zero Permission Access approval for payment-event delivery.
4. Have the developer deploy the reviewed endpoints and configure the dashboard's V2 `in_app_purchase` callback subscription.
5. Complete explicitly authorized purchase, recovery and refund acceptance. A callback verification handshake alone does not prove that real payment events arrive.
6. Enable checkout only after the signed receipt, signed webhook, one-time grant, recovery, refund and deletion requirements are accepted.

### Ads

Review the existing Audience Network property and placements before creating replacements. Confirm their current approval and test-ad setup. With the developer, verify real host behavior for reward completion, cancellation, no fill, interstitial frequency and the ad-free purchase. Keep ads gated until their acceptance is complete.

You can continue when each enabled paid feature has its own hosted evidence. Uploading a testing build does not require declaring these unfinished features ready.

## 9. Review and release the accepted version

1. Review any remaining required actions and permission, partner, quality, rating and payment decisions in Meta.
2. Have the developer identify the exact accepted ZIP, source revision, backend revision and rollback candidate.
3. Review the completed private testing and enabled-feature evidence.
4. Explicitly authorize the intended review submission, production promotion or publication when ready. These are separate actions from uploading a draft.

Use [the operations guide](facebook-instant-games-operations.md) for release records and [Meta's launch guide](https://developers.facebook.com/documentation/games/launch/game-launch) for current provider requirements. Older checklists are useful references, but their dated status tables must not replace the current dashboard.

## If you get stuck

| What you see | Next action |
| --- | --- |
| Codex reports read-only Meta access | Use Web Hosting directly or obtain its separate Asset Upload Access Token. MCP Manage access alone does not add uploads. |
| No Web Hosting or Upload Version control | Confirm the selected app and your role, then inspect the Instant Games use case and any required-action notice. |
| Meta rejects the ZIP | Capture the exact validation message and fingerprint; have the developer fix and prepare a new candidate. |
| Upload times out or no new version is obvious | Reconcile the full version list and retained attempt before retrying. |
| Build is accepted but game fails to start | Inspect the hosted error and matching backend configuration with the developer. |
| Payment methods are unavailable | Check payment approval, payout setup, supported SDK capabilities and the authenticated rollout configuration. |
| Review says both pending and unsubmitted | Resolve the existing state in the dashboard or with Meta support before another submission. |

Start now with step 1. The first useful checkpoint is seeing this app's **Web Hosting** page and its **Upload Version** and **Get Asset Upload Access Token** controls.
