# Multiplayer fallback rivals

Verified locally on 30 September 2026 in the Riddle Quest repository.

When authenticated multiplayer discovery completes with no eligible recorded race, the server supplies an owner-bound fallback offer. The session enters the normal preparation and countdown flow automatically. Available human recordings are still selected first. Transport errors, capped searches and corrupt projections remain retryable failures; they do not silently launch a fallback.

Fallback rivals use fictional names and ordinary opponent presentation. The bot marker stays in server storage and is omitted from the public run projection. No provider account, copied human identity or creator settlement delivery is fabricated. The client does not display a bot label or an empty-pool message when a valid fallback is offered.

Pacing uses the player's category-specific performance estimate, adjusted for the immutable deck's difficulty. Each search varies the name, question durations, hints and occasional skips. Events have consistent penalties and ten correct answers. Pacing is bounded, and the last event agrees with the scored finish. The complete ghost is generated during canonical acceptance; subsequent animation needs no bot simulation calls to the server.

The owner/request key fixes each fallback offer. Repeated discovery returns its original selection, concurrent acceptance creates one run, and repeated start/readiness delivery retains the run and scored countdown. Start intents persist through reloads. Rematches perform a new opponent search. Account replacement invalidates the prior provider adapter. Accepted bot runs use the normal server answer checks, loss deadlines, terminal settlement and publication restrictions.

Empty indexed pools require one candidate scope query, using an existing Firestore index. Nonempty discovery keeps its 200-document retrieval budget, including the availability probe. The new `raceBotOffers` records have a TTL configuration and are included in account deletion.

## Verification

- Backend race coverage: 46 suites, 654 tests passed; statements 95.03%, branches 83.82%, functions 97.38%, lines 96.81%. Includes human-first selection, empty-pool query count, concurrent acceptance, reconnects, wins, unattended losses, ownership, preference and expiry rejection, and corrupt-projection rejection.
- Frontend race/provider regression: 20 suites, 320 tests passed, including five new fallback session tests.
- Core race contracts: 3 suites, 49 tests passed.
- Injected browser verification at 1280×900 and 390×844: ordinary rival name, no bot label, automatic fallback preparation, advancing ghost progress, ten solved answers and the resulting completion screen. Browser fixtures exercise the actual multiplayer component with injected provider and authority seams; backend authority is independently tested in the emulator.
- All six isolated client bundles compiled: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. The first build pass also passed all six artifact audits. After concurrent workspace dependency updates, the final Jest audit reports 591,510 initial-resource bytes against its 0.55 MiB budget; the other five audits still pass. The React vendor chunk grew from about 190 kB to 219 kB between those runs. The fallback browser journey passes against the current source. This unrelated startup-size gate remains a release limitation.
- Backend and portal type checks, changed backend lint and module-cycle checks passed. The first file-size audit passed. A later audit reports an unrelated concurrently edited authentication browser-test file at 1,210 equivalent lines against a 1,200-line limit; fallback files remain within their limits.

Browser verification can be repeated with `node packages/portal/scripts/verify-race-fallback-browser.mjs`. If the matching Playwright browser is unavailable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium-compatible browser. Screenshots are in `artifacts/race-fallback/`.

Changes have not been deployed. Release requires the updated shared contracts/client, Firebase Functions and Firestore TTL configuration.
