# Facebook approval walkthrough

App: Riddle Quest (`1748953042991569`). Owner-approved boundary: prepare and verify the release, then obtain final approval before public publication.

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
