# Live guidance translations and target geometry — 5 October 2026

Guidance now refreshes its title, body and highlighted target when a new locale's catalog commits. Arabic direction changes move the spotlight with its actual control. Centered guidance, which has no target selector, no longer installs target scroll/resize listeners or invokes their update callback.

The coordinator keeps the existing active step, translated keys, focus policy, suspension behavior and seen markers. Anchored guidance still measures before paint, follows viewport signals and scrolls Profile targets into view. No provider, authority, economy, gameplay validation or SDK boundary changed.

## Diagnosis

The preceding tooltip pass removed centered card measurement. Follow-up transition traces still showed work in the guidance coordinator. Inspecting that path exposed a locale subscription whose return value was unused: the tooltip content memo depended only on its step ID, and target geometry depended only on the step ID and suspension. A locale change therefore updated Got it while leaving the title/body in the previous language; the target could also move without refreshing its spotlight.

The first fixture attempt encountered the earlier achievement tooltip instead of the intended leaderboard tooltip and timed out after 12 partial observations. Those results are excluded. Seeding that existing achievement seen marker isolated the intended real coordinator paths.

The corrected original German comparison failed eight of 32 checks twice. A prototype changing only the content's locale dependency removed six copy failures and retained two centered-target-work failures. Skipping target callbacks for selector-free guidance removed those failures; the Arabic control then exposed one remaining spotlight failure in 34 checks. Adding the committed locale to the target effect fixed that isolated gap. The complete German/Arabic prototype passed all 68 checks.

The final frozen minimal comparison used the same verifier and Arabic layout: original 34 checks / nine failures / exit 1; repaired 34 / zero / exit 0. Expectations were not weakened.

## Verification

- Real GuidanceOverlay in StrictMode: 1,632 assertions per React mode, zero failures across all 16 supported locales, two placement scenarios and three viewport sizes (390 × 568, 390 × 844, 1280 × 844). There were 192 focused journeys across both modes. Checks cover copy, active step, live RTL target alignment, 32 native parent updates, viewport signals, suspension, locale changes while suspended, resumption, translated card fit, native dismissal and persistence.
- Guidance under blocked/failing storage: 114 assertions per mode, zero failures. Combined final browser assertions: 3,492.
- Firefox MCP independently reproduced English title/body with a German action and an Arabic target at x=230 while the original spotlight stayed at x=34. The repaired spotlight moved to x=224, its correct six-pixel padding. Live copy, suspended locale changes, resumption and native dismissal passed; centered target callbacks stayed at zero, and dismissed/suspended guidance did no target work. Nine verified records had no browser errors or unhandled rejection.
- The initial Firefox anchored attempt inherited the centered fixture's game-tour seen marker because it reused the same local origin. Only that fixture marker was reset before the verified comparison. Its failed preparation attempt remains in `firefox-attempts.json`.
- Portal unit tests: 2,758 passed across 297 suites. Types and TSDoc passed (25,216 documented declarations across 1,140 files).
- All six isolated target builds and artifact audits passed. YouTube used the explicit fixture build; this evidence does not certify a YouTube release.
- Eight built-game tests across three suites passed against the new Jest/Reddit artifacts: hosted gameplay/navigation, Profile walkthrough and Reddit flows. Existing latency assertions were unchanged.
- 1,502 selected source inputs remained unchanged through final verification. Exact after-files match current source. Changes are captured in `own.diff`; the verifier is registered for both React modes and in the main browser command.

All 1,300 built files were preserved and hash-checked. The unique temporary build directory was removed after testing. Both Firefox servers exited successfully, their fixture caches were removed, and only this pass's two tabs were closed.

This pass proves live guidance correctness and removal of unnecessary centered target callbacks. It does not establish an end-to-end latency gain or resolve every CPU-throttled timing spike. The broader goal remains active. Raw observations, screenshots, logs, source captures, prototype variants, Firefox records, build hashes and `verification-summary.json` are under `artifacts/guidance-locale-work-2026-10-05/`. No commit, push or deployment was made.
