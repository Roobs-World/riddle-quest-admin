# Instructions modal fit

Settings → Help now keeps the existing instructions in one readable panel. It removes duplicate paragraph/heading margins, aligns the three color-clue rows, and reduces scoped padding and gaps. All visible text remains unchanged. Paragraphs use 16 CSS px, subsection headings use 18 CSS px, and Got It has a minimum height of 48 CSS px. The modal and its content use visible overflow, so clipping cannot disguise a failed fit. Onboarding is unchanged.

The old artifact reproduced the official Simulator measurement at 402 × 682: instructions client height 545 px and scroll height 591 px. The CSS prototype then passed all 48 combinations of the 16 supported locales and these viewports:

- 402 × 682, the actual Jest Simulator inner frame.
- 320 × 568.
- 390 × 844.

Every original goal, color clue and tip remained present. The prototype checked text size, modal/page overflow, element bounds and the fully visible primary action. Polish at 320 × 568 was tightest: Got It ended at y=546.20, leaving 21.80 px to the viewport bottom. German left 22.70 px. Arabic and Hindi screenshots were visually inspected and remained readable. See instructions-prototype-results.json, instructions-prototype.log and the screenshots beside this file.

Changed source files:

- packages/portal/src/play/modalPages/information/InformationModalPages.tsx adds three clue-row classes.
- packages/portal/src/styles.modal-shell.css replaces the scrolling layout with compact spacing and aligned rows.
- packages/portal/src/play/__tests__/instructionsModalScroll.jest-playwright.test.ts replaces the prior scroll requirement with content, type size, geometry, action and closing checks across all 16 locales and three sizes.

Source validation on the frozen implementation:

- Full portal unit/component suite: 320 suites and 3,326 tests passed. See unit-results.json and unit.log.
- Targeted utility-modal suite: 3 tests passed. These are included in the full run. See utility-unit.log.
- Production and direct browser-test TypeScript checks passed. See production-types.log and test-types.log.
- Comprehensive TSDoc audit passed for 28,803 declarations. See tsdoc.log.
- Scoped whitespace check passed.

The prototype served the existing artifact with injected CSS and made no shared build or upload. Root owns the canonical build/upload. The platform agent owns independent acceptance on the immutable rebuilt artifact. The updated repository browser regression is typechecked and awaits that artifact for execution.
