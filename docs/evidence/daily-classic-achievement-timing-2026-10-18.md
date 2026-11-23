# Daily continuation and achievement timing

Three agents traced the completion flow, achievement presentation, and cross-flow risks. The completed Daily path reused the old Daily session token and riddle ID when requesting another puzzle. The host consequently recovered the same Daily instead of loading Classic. A fresh local Daily win could also enable Next before its final guess and completion receipt were acknowledged.

The next-puzzle request now selects Classic when the loaded Daily matches the terminal outcome. It omits the old Daily locators and uses the current Classic index. The original Daily outcome remains unchanged for completion delivery. Daily victory Next waits for the guess and completion acknowledgement. Nonterminal Daily recovery, unrelated stale outcomes, and Classic successor selection retain their existing behavior. The ordinary Next button, fallback control, and acknowledged-loss continuation use this same request path.

Achievement tabs previously mounted in the same render as the result dialog and appeared above it. They now wait until the modal has had a paint opportunity, then render behind the dialog. Their animation callbacks retire on unmount. Pause, hidden-document, reduced-motion, and acknowledgement handling remain intact. The dialog owns the sibling live region through a stable accessible ID, including an empty hidden target before presentation and after completion. The badges remain decorative and do not grant coins. Existing server completion and platform milestone work stays detached from modal presentation.

## Validation

Portal TypeScript compilation passed. Static provider boundaries, all 16 locales, dependency notices, Jest Console configuration, artifact size, upload preflight, and W3C HTML validation passed. Independent source review found no remaining blocker. Existing behavior fixtures cover completed Daily wins and losses, original completion identity, ordinary recovery, stale outcomes, and Classic successor selection. No tests or browser harnesses ran.

The initial package exceeded the unchanged release budget by 932 bytes. Eight CSS references embedded the same background SVG. Those references now use Vite's supported `?no-inline` option, and the build contains one byte-identical 504-byte SVG. No image content changed. The final artifact contains 419 files and 4,715,268 extracted bytes, within the existing 4.5 MiB release budget and 0.55 MiB initial-resource budget.

## Jest upload

Jest finished processing version `1.0.0-dev.20261018-daily-classic.mve8q8x5`, ID `01a15091-26c9-743e-b867-c6c18f78ea28`, to ready, inactive, without a processing error. [Preview the corrected build](https://jest.com/g/riddle-q?versionId=01a15091-26c9-743e-b867-c6c18f78ea28). The 2,874,848-byte ZIP has SHA-256 `df7ec807b74cd4e261b69a5c0e26294d6bb68b7eb317975f45bd0e96825e9304`. Independent readback and the archive hash are recorded in the [upload receipt](../../artifacts/jest-uploads/daily-classic-20261018/upload-receipt.json).

The current production lobby build remains active. This request changed client behavior; no backend deployment, frontend activation, publication, or review submission occurred.
