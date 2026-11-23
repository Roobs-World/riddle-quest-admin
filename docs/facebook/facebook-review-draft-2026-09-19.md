# Riddle Quest — Facebook review preparation

**Status: preparation in progress; not ready for final submission.**

For the latest local build, checks, unpublished ZIP and portal access status, see the [27 September readiness record](evidence/facebook-review-readiness-2026-09-27.md). The artifact and status details below describe the 19 September handoff and should not be treated as current portal readback.

For the current sequence and owner-only steps, see the [approval walkthrough](facebook-approval-walkthrough.md).

Owner-confirmed release boundary: prepare a complete Facebook release candidate with verified IAP, preserve the other Web Targets, and stop for owner approval before public publication. Retain historical content themes and declare them accurately for rating.

App: `1748953042991569` · Business portfolio: `2198725140593714` · Game Page: `61593702081276`.

## Saved in Meta

- Publisher: Roobs World.
- Category: Trivia & Word (saved and read back).
- Contact: grindheadgames@gmail.com.
- Website: https://roobsworld.com.
- Terms: https://roobsworld.com/riddle-quest/terms (public HTTP 200).
- Privacy: https://roobsworld.com/privacy.
- Signed data deletion callback configured.
- Owner confirmed the Facebook audience is 13+; Meta now shows App Details Compliance **Complete**.
- IARC contact email and United Kingdom country saved. The questionnaire is open; no certificate is yet verified.
- All required media accepted: 1024px app icon, 16px small icon, 1600×300 cover, 1200×627 banner, and 1280×720 landscape gameplay preview. A fresh media reload showed no missing-media notices.
- Testing version 2: bundle `28534304219568921`, source `828f46dbfda0764b13c42087dc4ccc979bd659bd`.

## Reviewer gameplay instructions

1. Launch the latest Testing build for app 1748953042991569 using a Meta app-role account. No separate Riddle Quest password is required.
2. Allow the Facebook startup and account restoration flow to finish. For a fresh player, complete the two-step introduction.
3. In Classic, read the clue, select the answer letters on the on-screen keyboard, and submit. A correct answer opens the win screen. Collect the reward and choose Next Level.
4. Verify progress and the coin balance persist after closing and relaunching the game. Existing role-account tests have completed real hosted sign-in, correct answers and reward collection.
5. Check that the game pauses/resumes correctly around provider overlays and browser visibility changes. Injected browser harnesses pass, but these do not replace Meta review.
6. Facebook purchases are **not exposed in this testing build**. The seven-item Meta catalog exists, but the supported payment APIs and the signed receipt/refund verification path still require end-to-end acceptance. Do not describe or submit this build as a completed IAP release.

## Partner-program draft copy

Roobs World Limited is a UK software and games company, trading as Roobs World. We develop Riddle Quest, an HTML5 riddle and word game that combines short written clues with letter-by-letter answer entry and colour feedback. Players can solve Classic puzzles and Daily Challenges, build a streak, earn in-game coins and use hints. The Facebook version is intended for eligible players aged 13 and above. We are preparing a Facebook Instant Games release with platform sign-in and saved progress. The planned optional purchase catalog contains fixed coin packs and a durable entitlement that removes interstitial advertisements; coins are used only within the game and cannot be redeemed for cash. Facebook commerce remains under integration and will be tested before the purchase-enabled release is submitted. Our codebase also has separate builds for Jest, Reddit and YouTube, with platform capabilities isolated. We provide public terms, a privacy policy and email support through roobsworld.com and grindheadgames@gmail.com. Account identity, rewards and purchase grants are designed to be verified by our server. We are applying to the Approved Partner Program to complete the required platform, policy and quality reviews before making Riddle Quest publicly available on Facebook.

Verified off-Facebook listing: https://jest.com/g/riddle-q loaded in the browser with title “Riddle-Q | Jest.com” and the Riddle-Q game listing. This confirms listing availability, not a fresh end-to-end Jest gameplay test.

## Open gates

- Approved Partner Program application: Not Submitted. After owner verification, Business Settings lists **Riddle Quest — Owned by Roobs World**, and the partner application's developer Page selector now offers Riddle Quest. It has been selected and the draft copy restored. The form has no separate visible Save Draft action; prepared text is preserved here as well as in the open form.
- Business Settings displays Page asset ID `1166496769890025`; the original owner-supplied Facebook profile URL uses `61593702081276`. The lookup used that exact supplied URL. Preserve both identifiers until their platform mapping is independently confirmed; do not assume they are interchangeable API IDs.
- The application inherits the old address `2 Levetts Fields, Lichfield, WS13 6HY` and old Firebase-hosted website from Business Settings. The current Companies House address is `3 Wherry Way, Dobwalls, Liskeard, England, PL14 4NS`; correct the inherited business information before submission.
- Attempting to save the verified address and `https://roobsworld.com` returned **Error performing query / Unable to save changes. Please try again.** The old details remain saved. The disabled county field and existing phone/tax fields were left unchanged.
- The owner has no Apple Developer account or Team ID and is building an HTML5 web game. Meta's legacy form asks for a Team ID; its linked FAQ redirects to new documentation. No ID has been invented and no Apple enrolment undertaken.
- Meta's [current Approved Partner Program guide](https://developers.facebook.com/documentation/games/launch/approved-partner-program), read in the signed-in browser, accepts live-game links from gaming websites as well as mobile stores and does not list an Apple account as a prerequisite. This is not proof that the legacy Team ID field will accept blank at submission; its validation remains untested.
- Policy/Quality review Create submission is currently disabled. No review submission or public release has been made.
- IARC is incomplete. Owner chose to retain content and rate it accurately. Reviewed race riddles contain historical war references, so the draft now declares violence references and digital purchases. Remaining follow-ups and the live Classic/Daily corpus need review before issuing a certificate. No blanket all-content-negative declaration is supported.
- Purchase activation, authoritative signed-receipt verification and refund/recovery acceptance remain outstanding. The commerce activation guard remains intact.
- Fresh Game Payments inspection confirms **a valid payment account is required** and none is registered. Payout setup is open at step 2/5 after selecting UK / Private corporation. Tax, banking and certification fields remain owner-only; prefilling the proposed public company address is awaiting direct confirmation after an automatic approval rejection.
- The live `/privacy` page describes portfolio-site processing only. A [Facebook-specific notice draft](facebook-privacy-draft.md) now records verified processing and remaining publication gates. Owner approved 90-day retention after closure for routine reports/support, with documented dispute/legal exceptions; implementation remains required.
- Source audit found Facebook account authority incorrectly gated on Jest registration. The verified fix adds explicit Facebook username/deletion permissions, keeps avatar upload unavailable, and checks deletion authority before shutting down player operations. It passed all four builds, browser regressions and 753 portal tests. It is not yet in Meta's version 2 testing bundle.

## Updated testing artifact awaiting upload authorization

- Isolated clean source: `7d02b848eb17d2468ed8ab8600c1a0f7235bbc0f` in `/tmp/riddle-facebook-release-candidate`.
- ZIP: 2,745,554 bytes, 421 archive entries.
- SHA-256: `185b01400b24ec52fd6bb86b556c441882dccdf1c15082fa350f48d6791ebb15`.
- Immutable path: `/tmp/riddle-facebook-release-candidate/packages/portal/.facebook-upload-receipts/artifact-185b01400b24ec52fd6bb86b556c441882dccdf1c15082fa350f48d6791ebb15.zip`.
- Artifact and source secret-boundary audits passed. Commerce remains unavailable in runtime.
- The local upload handoff is opened and the file is selected in Meta's Upload New Version dialog. Automatic approval review rejected the command that would submit the upload because it requires explicit authorization for this exact external code payload. No upload acceptance or testing activation is claimed. Owner approval is pending; do not bypass the rejection.

## Verification and observations

The all-target build/isolation and browser checks documented in the [port evidence](evidence/facebook-port-verification-2026-09-19.md) remain the latest code verification. This preparation changes external metadata and submission media, not game runtime code.

Meta image upload error 1357032 occurred while acting as the Riddle Quest Page. Switching back to the owner profile resolved it; all four required uploads then succeeded.

During footage capture, the actual hosted KIWI answer completed and awarded 25 coins, taking the balance from 450 to 475. The win flow briefly showed a loading state while awaiting the host. A second capture encountered browser-coordinate interference; that footage is not suitable for submission. Final video checks are recorded separately below.

Final accepted footage is `facebook-assets/gameplay-landscape-1280x720.mp4`: 28 seconds, H.264, 30 fps, yuv420p, silent, 399,090 bytes. It shows actual hosted SNAIL gameplay and the settled 75-coin win screen. Frames were cropped to exclude Facebook wrapper notices and padded to landscape; no gameplay outcomes were fabricated. Sample frames at 8 and 26 seconds were visually checked before upload. Meta accepted the video, and the media page retained its Edit control after reload.
