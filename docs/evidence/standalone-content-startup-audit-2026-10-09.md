# Standalone content startup audit — 2026-10-09

No production change was justified by this audit. The production content plugin already coalesces concurrent requests in a retained promise and decrypts each successfully loaded locale pack once. A failed import clears that promise and retries a local asset URL with a fresh retry query. The runtime's additional `readProtectedContent` call receives plaintext and returns it without decrypting again.

Ordinary boot chooses one locale and loads one pack. Recovery-save and reset-save retries retain their runtime or prepared content instead of loading another pack. Pre-locale and full-load retries can repeat domain parsing; no material player latency attributable to that parsing was measured here, so this audit does not claim a latency improvement or justify another memory cache.

Evidence in `artifacts/standalone-content-startup-audit-2026-10-09`:

- `verify-loader.mjs` executes the actual generated loader body with an injected module transport. It proves two concurrent calls share one promise, later successful calls share the resolved pack, one import/one decode occurs, and failed downloads retry `/local/en.js?retry=1`. It does not exercise real browser module downloads.
- `loader-result.json` records those assertions. The temporary fixture directory was removed in `finally`.
- The existing production content plugin test passed; 37 focused content, local-authority and save-gate tests passed across three suites.
- All 2,525 previously verified source inputs match the preceding save-ordering cohort. That cohort already built all six targets and Devvit; builds were not repeated for this audit because executable project inputs are unchanged. See [the preceding cohort](standalone-save-ordering-audit-2026-10-09.md).

No UI changes, deployment, cloud latency measurements, or native-browser performance claims are made. The broader improvement goal remains active.
