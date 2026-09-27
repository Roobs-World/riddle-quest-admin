# Facebook review readiness — 27 September 2026

App `1748953042991569`. This is a preparation record. No Meta review was submitted, no public release was made, and no testing bundle was uploaded during this check.

## Local candidate

- Source commit at packaging: `c08cf6195334584f3d9531c7f2600e9eaf27e73c` (clean when packaged).
- Local, unpublished ZIP: `packages/portal/.facebook-upload-receipts/artifact-636cb6bbb590cdab9f743ab8122886a3f3c3b011f3f3bfb7da579bc9b74ebada.zip`.
- SHA-256: `636cb6bbb590cdab9f743ab8122886a3f3c3b011f3f3bfb7da579bc9b74ebada`; 2,754,971 bytes; 422 entries. The copied artifact hash was checked after packaging.
- The Facebook artifact audit passed (420 files; isolated Facebook SDK/config; no Jest/native/secrets leakage). Facebook secret, profile, commerce activation, copy, and backend preflight checks passed. Backend preflight ran 92 suites / 1,016 tests.
- All isolated targets built through `pnpm --filter @qwordly/portal verify:all-targets`: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, plus GameSnacks. Jest gameplay and authentication browser checks passed (13 and 30 tests). Release-script checks passed (127 tests). The Facebook injected-SDK browser harness passed on rerun (one test); its first run timed out clicking a transiently unstable account-deletion confirmation button. Reddit, YouTube and standalone browser checks passed (1, 10 and 2 tests). The combined `verify:all-targets` command did **not** pass because it stopped at that first Facebook harness timeout.

## Live checks and portal work

- `https://roobsworld.com/riddle-quest/terms` returned HTTP 200.
- `https://roobsworld.com/riddle-quest/privacy` returned HTTP 404. The current `https://roobsworld.com/privacy` returned HTTP 200, but the dedicated Facebook privacy notice remains a draft and the existing page does not cover the game processing described in that draft.
- The owner signed in to the automated browser. Basic settings still show the Roobs World contact, the published terms URL, `https://roobsworld.com/privacy`, and the configured signed deletion callback. The dedicated Facebook notice is still unpublished; its intended URL returns 404.
- Meta Web Hosting shows **Testing version 3**, bundle `28625402820405523`, uploaded on 20 September from source `d53596b4` with SHA-256 `50fd13547d5dab5049b24d5d7cf4a2cbb0d06d04e558a230c4a946cb86f50c45`. Version 2 is Standby. The locally prepared candidate above is newer and has not been uploaded.
- Meta's saved listing had described optional purchases as available. The long description was corrected and read back after navigating away: “Optional in-app purchases are planned but are not available in the current testing build.” Publisher, category, tagline and accepted icons remain saved. No review submission was made.
- The Web testing instructions now contain the Instant Game link, an app-role login path, two-step onboarding, Classic/Daily and saved-progress checks, and the explicit disabled-purchase state. Facebook Login is correctly marked “No.” These values persisted after a reload.
- Audience details show 13+ compliance **Complete**, but **No IARC Certificate Found**. The Game Payments screen still shows seven products and test payment mode on, but says a valid payment account is required and offers “Set up payout.” The Approved Partner Program application remains **Not Submitted**; Policy/Quality submission controls are disabled.
- The partner application still inherits the old `2 Levetts Fields, LICHFIELD, WS13 6HY` address and Firebase-hosted website. A website-only correction to `https://roobsworld.com` in Business Settings returned “Error performing query”; no successful save is claimed. The address was not edited without the owner's correspondence-address confirmation.
- Meta's Required Actions page showed no app-specific tasks when checked; its header still displayed a badge count of one.
- The local commerce SDK adapter and server ledger remain staged, while runtime commerce and the public signed-receipt/refund verification path are disabled. No real checkout, recovery or refund has been accepted. The seven-item catalog is not evidence that IAP is ready.
- IARC, Approved Partner Program, valid payment account, and the business-details correction remain incomplete. Testing version 3 predates the current source. The new ZIP needs a specifically authorized testing upload and hosted acceptance before review readiness can be claimed.

## Next portal session

If testing upload is authorized, upload the exact ZIP hash above, activate Testing, and exercise hosted identity, gameplay, profile changes/deletion with a disposable role account, pause/resume and supported SDK APIs. Complete the privacy notice, IARC rating, business/partner details, payment account and commerce verification before calling the release review ready. Keep review submission and public publication closed.
