# Facebook approval walkthrough

App: Riddle Quest (`1748953042991569`). Owner-approved boundary: prepare and verify the release, then obtain final approval before public publication.

## Restore programmatic uploads

On 24 November 2026, both Node and curl binary uploads received HTTP 403. Meta's nested error says the user must be an admin or developer of the app. The MCP confirms the signed-in owner is an admin, but the saved `GG|app-id|…` credential is an App Access Token and carries no user role. Meta accepts it for session creation; that does not authorize the binary transfer. See the [diagnosis evidence](evidence/facebook-upload-diagnosis-2026-11-24.json).

1. Open [Access Token Tool](https://developers.facebook.com/tools/accesstoken/) while signed in as an admin or developer of Riddle Quest.
2. Locate the **User Token** above the **App Access Token**. If the User Token is absent, follow the request link to [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select **Riddle Quest**, and obtain a **User Access Token** through the account's consent flow.
3. Replace the value of `FACEBOOK_APP_ACCESS_TOKEN` in the ignored root `.env` with that complete User Token. Keep the existing variable name. Save the file and keep the value out of chat and Git.
4. Run `pnpm preflight:facebook-upload` from the project root. Use the SHA-256 it prints with `pnpm facebook:draft upload --archive-hash EXACT_64_HEX_SHA256` only for an explicitly requested upload. An unchanged valid App Access Token will reach the same role check.
5. Confirm the new bundle appears in **Instant Games → Web Hosting** and finishes processing before recording acceptance or assigning it to production. A successful session or transfer alone does not prove processing completion.

For durable automation, Meta also supports a System User token assigned **Manage app** access to this app in the owning Business Portfolio. That `EAA` token uses the `fb_game_bundle` upload namespace. Follow [Meta's System User setup](https://developers.facebook.com/documentation/games/launch/upload-bundle#setting-up-a-system-user-access-token-for-cicd); its guide says no additional permissions are needed for bundle uploads. The uploader selects the namespace from the saved token's prefix.

## Current order of work

| Step | Current state | Next action | Responsibility |
| --- | --- | --- | --- |
| Business verification and Page | Business verified; Riddle Quest Page connected to Roobs World | Correct the stale business address/website; prior saves returned a Meta query error | Agent can prepare/retry verified details; owner confirms tax-correspondence address |
| Approved Partner Program | Not Submitted | Reconcile inherited details, complete application and resolve the legacy Apple Team ID field | Agent prepares; no invented Apple ID or unnecessary Apple enrollment |
| Updated testing bundle | Version 4, bundle `28232737223063645`, staged for Testing; downloaded ZIP matched local SHA-256 | Complete hosted gameplay, save, profile, lifecycle and ad checks | Agent and role-account tester |
| Listing and age rating | Required media uploaded; 13+ audience declared; IARC unfinished | Review actual content and complete rating follow-ups accurately | Agent investigates and prepares; owner has chosen to retain historical themes |
| Privacy and operations | Dedicated Facebook notice is live at `https://roobsworld.com/riddle-quest/privacy` and saved in Meta Basic settings | Verify operational support and retention practices against the published notice | Agent implements; owner supplies operational decisions |
| Payments | Seven products registered; no valid payment account; runtime commerce disabled | Complete payout setup, implement and verify receipts/refunds/recovery, prepare IAP evidence | Owner supplies tax/bank/certification in Meta; agent handles implementation/testing |
| Final review and release | Partner, policy, quality and IAP reviews not submitted | Complete prerequisites and obtain owner approval for the final release action | Owner approval retained |

Meta's Game Payments panel currently says IAP approval requires a production bundle, at least one registered product and a payment account. This does not authorize prematurely promoting an incomplete build: test purchases can be developed separately, and production/review sequencing must be reconciled before final approval.

## Payout setup — current browser position

Opened **Game Payments → Set up payout**. Selected **United Kingdom → Private corporation**, consistent with the supplied UK company. The dialog is now **step 2 of 5**.

It asks for business name, business address, city, state, postcode, phone, Tax Identification Number, optional VAT/GST number and a certification. No tax number, bank information or certification has been entered by the agent.

Proposed public details awaiting direct confirmation:

- ROOBS WORLD LIMITED
- 3 Wherry Way, Dobwalls
- Liskeard, PL14 4NS, United Kingdom

Automatic approval review rejected entering these details because the registered address had not been directly confirmed by the owner. The owner has been asked to confirm it is suitable for tax correspondence. Do not bypass this block.

Enter tax and banking information directly in Meta. A UK company's Corporation Tax UTR is a ten-digit identifier found in HMRC correspondence; it is distinct from the Companies House registration number. See [HMRC's UTR guidance](https://www.gov.uk/find-utr-number). Follow Meta's field-specific guidance or the company's accountant if the requested tax classification is unclear. Leave VAT/GST blank only if the company is not registered, as Meta instructs. The owner must review the certification before checking it.

## Current interview frontier

1. Identify who monitors `grindheadgames@gmail.com` for support, privacy and safety reports.
2. Confirm the proposed payout business details or provide the correct address.

Already settled: Facebook audience 13+; retain historical themes and rate accurately; routine resolved support/report records retained 90 days after closure with documented dispute/legal exceptions; public publication waits for final owner approval. Do not ask these again unless the owner changes them.

No new runtime code changed during this walkthrough. The [testing upload evidence](evidence/facebook-testing-upload-2026-09-27.md) records the current artifact and hosted check; the [release draft](facebook-review-draft-2026-09-19.md) and [earlier verification evidence](evidence/facebook-port-verification-2026-09-19.md) contain remaining engineering gates.
