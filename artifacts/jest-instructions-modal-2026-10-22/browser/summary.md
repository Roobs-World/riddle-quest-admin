The corrected Instructions modal passes all requested compiled browser checks. No local check remains pending.

- Immutable Jest artifact: `../jest-artifact`, 419 files and 4,717,648 bytes. Initial entry resources total 576,162 bytes.
- Manifest SHA-256: `08c4ec32eedd71896eb9964b8bf1ba324b4aa460b4950bfd3d39c3cb7024be03`. Every file still matches the manifest after both runs.
- Eight retained browser suites passed all 77 tests, with zero failures or skips, in 298.041 seconds. The new Instructions regression has three viewport cases, each checking all 16 supported languages. Other retained routes cover onboarding, solo, Daily, profile, mocked commerce, authentication, viewport fitting and audio.
- Independent Settings → Help acceptance passed all 48 language/viewport combinations through real language-menu selection and ordinary button clicks. Sizes were the measured Simulator inner viewport of 402 × 682, narrow phone 320 × 568 and phone 390 × 844. Arabic RTL was included.
- Every original goal, color-clue and tips string is visible in one panel. The modal and its content require no vertical or horizontal scrolling; text rectangles stay inside the modal. Body text remains at least 16 CSS pixels, and Got It remains at least 48 pixels high, visible, unobscured and enabled. Clicking it dismisses the modal.
- The tightest result is Polish at 320 × 568. Got It ends 21.80 pixels above the viewport bottom, with all text visible. No pagination or onboarding change was needed.

The 48 combinations were independently repeated as layout acceptance; they are not added to the retained test count as 48 new distinct user routes. Tests use the exact compiled artifact with local mock providers. No app-source edit, rebuild, real charge, SMS or production write was performed by this verifier. Actual hosted Simulator acceptance and publication belong to the root task.

Results: [consolidated report](verification-summary.json), [independent layout results](results.json), [retained browser results](retained-browser-results.json), [artifact hashes](artifact-inventory.json).

Screenshots: [actual-size English](en-402x682-page-1.png), [narrow Polish](pl-320x568-page-1.png), [actual-size Arabic](ar-402x682-page-1.png). All 48 screenshots use `{locale}-{width}x{height}-page-1.png`; retained journey images are under `retained-screenshots/`.

All ten shared screenshot output paths were copied into this evidence directory and restored exactly to their previous contents. [Restoration verification](retained-output-restoration.json).
