# Instructions modal correction, 22 October 2026

The modal fix, source checks, artifact checks, browser acceptance, upload, official Simulator checks, hosted URL verification, and replacement submission are complete. The corrected version is **In Review**. Approval remains pending and the game is unpublished.

Current release facts:

| Field | Value |
| --- | --- |
| Version | `1.0.0-dev.20261022-instructions` |
| Version ID | `01a16293-7459-71e2-95b3-94196b6540d0` |
| Processing | `ready`, no processing error |
| In-review revision | `01a160ef-28c7-7029-9351-c31297d8527c` |
| Submission | 22 October 2026 at 07:56:59.883 UTC |
| Console account | `grindheadgames@gmail.com` |
| Current rejection reason | null |
| `approvedAt` | null |
| `isPublished` | false |
| Artifact | 419 files, 4,717,648 bytes |
| Initial resources | 576,162 bytes |
| ZIP SHA-256 | `aaa8cb484e2d43909b623c156f9a00bffd79b835067aebc3e2fc8e5ba765fbf0` |

The connector's `activeVersionId` and the visible Console review both identify the exact corrected version. **Update pending submission** completed with the optional Fund checkbox explicitly unchecked. No terms were accepted.

The original Settings → Help modal required scrolling at the actual 402 × 682 CSS-pixel Simulator viewport. Its instructions area measured 545 px available and 591 px of content. Duplicate paragraph and heading margins caused excess spacing. The compact single-panel fix preserves all text, 16 px body type, and a 48 px Got It action. Onboarding is unchanged.

The final official Simulator measurement is client height = scroll height = 399 px. The modal is 472.33 px high. Got It ends at y = 560.16, inside the modal's y = 577.16 bottom. No content is clipped.

Completed verification:

- Fresh portal unit suite: 320 suites and 3,326 tests passed. Production and focused test type checks, TSDoc, and whitespace checks passed.
- Final compiled browser run: 8 suites and 77 tests passed.
- Independent Instructions acceptance: all 48 locale and viewport combinations passed across 16 locales at 402 × 682, 320 × 568, and 390 × 844. No scrolling or clipping was required. All artifact hashes remained unchanged. See [browser/verification-summary.json](browser/verification-summary.json).
- Official Jest Simulator BasicLaunch: 20 of 20 checks passed.
- Simulator mock recovery and purchases granted 7,000, 250, and 3,400 coins, reaching a wallet of 10,975. The shop then showed Premium active and no Subscribe action.
- The actual Daily MOUSE win awarded 180 coins: 100 Daily + 10 streak + 10 level-up + 60 achievement. The balance reached 11,155, and Next enabled automatically and advanced.
- Post-win D1 through D7 checks covered 35 notifications.
- All six other targets rebuilt successfully. Reddit passed 51 server and package tests. No backend deployment occurred.

One nonblocking referral reconciliation timeout warning appeared at 07:51 UTC. The official SDK events readback was empty. It did not prevent the verified Simulator flow.

The [version-pinned test URL](https://jest.com/g/riddle-q?versionId=01a16293-7459-71e2-95b3-94196b6540d0) is now fully verified on the actual hosted build. The existing sandbox player kept Classic TOASTER and 4,960 coins. Settings → Help showed every instruction with client height = scroll height = 351 px and visible overflow. The modal measured 424.359375 px high, from y = 104.3125 to 528.671875. Its 48 px Got It action ran from y = 463.671875 to 511.671875, fully inside. Visual inspection in the actual Jest shell passed, and Got It returned to the unchanged Classic TOASTER state. Both hosted and review tabs remain open.

All 23 checked Console images passed fresh reads and completed processing, with no pending replacements. Final external records are saved in `release-summary.json`, `review-status.json`, `versions-final.json`, `events-final.json`, and `image-moderation-final.json`. All requested verification and submission work is complete. Do not describe the build as approved or published.

The [final evidence record](../../docs/evidence/jest-instructions-modal-2026-10-22.md) contains the full diagnosis, corrected measurements, release identity, and submission status. Existing dirty work remains preserved. No Git commit, push, real charge, real account deletion, SMS send, or new agreement acceptance occurred during this correction.
