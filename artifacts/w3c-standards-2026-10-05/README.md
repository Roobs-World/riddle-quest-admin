# Web standards verification — 5 October 2026

All six isolated target artifacts are in the repository's `builds/` folder: `jest`, `facebook`, `reddit`, `youtube`, `netflix`, and `yahoo`. Default build paths, artifact audits, browser harnesses, packaging, release tooling, CI artifact collection, and current operations documentation use this location.

`pnpm check:w3c` passes with **zero findings** using the pinned local [Nu HTML checker](https://validator.w3.org/nu/), version 26.9.30. It checks seven entry documents, including Reddit's inline launcher. Missing files, errors, warnings, and advisory findings block the gate. Explicit document arguments remain supported for immutable release artifacts.

The injected Chromium browser harnesses validate the actual React DOM and run automated [WCAG 2.2](https://www.w3.org/TR/WCAG22/) A/AA checks. All **15 browser tests pass** across five suites covering six targets. All **31 retained rendered HTML snapshots** pass Nu with zero findings; matching screenshots are saved in `rendered/`. Coverage includes onboarding, tutorial, gameplay, offline recovery, confirmation dialogs, shop, profile, statistics, treasure, achievements, ranks, leaderboards, settings, rewards, out-of-attempts, provider recovery, Reddit RTL settings, and standalone home/game/victory screens.

The fixes restore the tutorial heading hierarchy, give shop cards proper headings, and give labeled coin/achievement containers appropriate semantics. Existing translated text is reused. Gameplay, tutorial, shop, and victory screenshots were inspected.

Additional verification passed: **152 release regression tests**, **13 packaging/dependency/production-gate tests**, portal TypeScript checking, all six target build isolation audits, and the staged Reddit package contract. The existing GameSnacks build also still packages successfully with the new paths.

Final verification used private staging artifacts to avoid concurrent builds replacing files during tests. Those exact artifacts were copied into `builds/`; their complete file inventories and SHA-256 hashes are recorded in `build-manifest.json` and were rechecked after copying.

Evidence:

- `entry-validation.log` and `rendered-validation.log`: zero-finding HTML checks.
- `jest-browser.log` and `provider-browser.log`: successful browser suite results.
- `release-tests.log`, `packaging-tests.log`, `types.log`, and `reddit-package.log`: supporting checks.
- `build-<target>.log`: builds and provider isolation audits.
- `rendered/`: audited HTML and screenshots.
- `build-manifest.json`: hashes of the final artifacts.

This records HTML validation, automated accessibility checks, and the keyboard assertions in the tested journeys. It is not a complete manual WCAG conformance assessment or W3C certification. External production provider services were represented by injected harnesses.

Completion recheck: all six artifact inventories still match `build-manifest.json`. The current seven entry documents and all 31 retained rendered documents pass the validator with zero findings. Five validator regression tests, the 16-locale audit, and all 11 target-boundary tests also pass. See `completion-audit.json` for the requirement audit.
