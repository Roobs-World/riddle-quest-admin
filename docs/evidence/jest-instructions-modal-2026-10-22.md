# Instructions modal correction, 22 October 2026

The corrected Instructions modal is verified and the replacement submission is **In Review**. Jest reports version `1.0.0-dev.20261022-instructions`, ID `01a16293-7459-71e2-95b3-94196b6540d0`, as processed and ready. Approval remains pending: `approvedAt` is null and `isPublished` is false.

The user clarified that Settings → Help must display its instructions without scrolling. The official Jest Simulator reproduced the problem at a 402 × 682 CSS-pixel game viewport. The modal was 646 px high, but its instructions area had 545 px available for 591 px of content. Got It was below the visible area. The device dropdown's 402 × 874 dimensions include browser and status chrome.

The layout combined a 12 px grid gap with 16 px paragraph and 18.72 px heading bottom margins. The fix removes that duplicate spacing and aligns each color marker beside wrapping text. All instructional text and translations remain unchanged. Body text stays at 16 px with a 1.35 line height, and Got It is 48 px high. Onboarding and other modals are unchanged.

Source changes are confined to `InformationModalPages.tsx`, `styles.modal-shell.css`, and `instructionsModalScroll.jest-playwright.test.ts`. The browser regression now checks the real Settings → Help route, every instruction string, readable fonts, element bounds, no overflow, and successful dismissal.

Verification passed on the final source and immutable artifact:

- The fresh portal unit suite passed 320 suites and 3,326 tests. Production and test type checks, TSDoc, and scoped whitespace checks also passed.
- The compiled browser run passed 8 suites and 77 tests, including the three Instructions viewport tests.
- Independent acceptance passed all 48 combinations of 16 locales at 402 × 682, 320 × 568, and 390 × 844. Every instruction and the final action remained visible, with no scrolling or clipping. Polish at 320 × 568 was tightest, leaving 21.80 px below the action. These independently repeated combinations are not additional distinct routes.
- All 419 artifact hashes remained unchanged after browser verification. [The browser verification summary](../../artifacts/jest-instructions-modal-2026-10-22/browser/verification-summary.json) records the exact artifact and results.
- All six other targets rebuilt successfully with their artifact and isolation checks. Reddit additionally passed 51 server and package tests. No backend deployment occurred.

The immutable artifact is `artifacts/jest-instructions-modal-2026-10-22/jest-artifact`. It contains 419 files, totaling 4,717,648 uncompressed bytes, with 576,162 initial entry bytes. It passes the unchanged budgets of 4,718,592 total bytes and 576,716.8 initial bytes, target boundaries, all 16 locale inventories, license checks, the artifact audit, and W3C validation. The ZIP contains 2,876,708 bytes and has SHA-256 `aaa8cb484e2d43909b623c156f9a00bffd79b835067aebc3e2fc8e5ba765fbf0`. Every ZIP file matches the immutable snapshot.

The official Jest upload completed processing with `ready` and no error. The corrected version was selected with **Use in pending submission**. After **Reload app**, the official Simulator confirmed the Help fix: instructions client height and scroll height both measured 399 px. The modal measured 472.33 px high. Got It measured 48 px and ended at y = 560.16, inside the modal's y = 577.16 bottom. This replaces the earlier 545/591 scrolling state without removing content.

The official Simulator checks also confirmed the following behavior:

- BasicLaunch passed all 20 checks.
- Mock purchase recovery granted 7,000 coins, a new `coinpack1` purchase granted 250, and Premium granted 3,400. The resulting wallet was 10,975. Reopening the shop showed Premium active and no Subscribe action.
- An actual Daily MOUSE win displayed the authoritative 180-coin breakdown: 100 Daily, 10 streak, 10 level-up, and 60 achievement coins. The balance became 11,155. Next enabled automatically and advanced play.
- Post-win D1 through D7 checks covered 35 notifications.

A nonblocking referral reconciliation timeout warning appeared at 07:51 UTC. The official SDK events readback was empty. The warning did not prevent the completed Simulator checks or Daily progression.

**Update pending submission** completed at 07:56:59.883 UTC on 22 October 2026 under `grindheadgames@gmail.com`. The optional Fund checkbox was explicitly unchecked, and no terms were accepted. The connector confirms in-review revision `01a160ef-28c7-7029-9351-c31297d8527c` with `activeVersionId` set to the exact corrected version above. Its rejection reason is null. The Console visibly shows **In Review** for `1.0.0-dev.20261022-instructions`. This is a submitted review, not approval or publication.

The [version-pinned test URL](https://jest.com/g/riddle-q?versionId=01a16293-7459-71e2-95b3-94196b6540d0) was fully verified on the actual hosted build. The existing sandbox player retained Classic TOASTER and 4,960 coins. Settings → Help displayed all copy without scrolling: instructions client height and scroll height both measured 351 px, with `overflowY` set to `visible`. The modal ran from y = 104.3125 to 528.671875 and measured 424.359375 px high. Got It measured 48 px, from y = 463.671875 to 511.671875, fully inside the modal. A screenshot in the actual Jest shell was visually inspected. Got It closed back to the unchanged Classic TOASTER state. Both the hosted and review tabs remain available for inspection.

All 23 checked Console images passed fresh reads and completed processing, with no replacements pending. Final connector records are saved as `release-summary.json`, `review-status.json`, `versions-final.json`, `events-final.json`, and `image-moderation-final.json` in `artifacts/jest-instructions-modal-2026-10-22`.

The previous [amendment record](jest-amendments-2026-10-22.md) retains the reward itemization, human-wait behavior, backend-local attribution repairs, and earlier route verification. Existing dirty workspace edits were preserved. No Git commit or push was performed.
