# Native player overlays retain committed ownership

Player overlays now isolate each provider/player/render-operation lifetime and each effect incarnation in its own native mount surface. Committing a new provider, player or render operation removes the retired surface before passive cleanup. Ordinary profile updates preserve the existing surface; an abandoned concurrent replacement cannot retire it. Deferred admission preserves the original provider receiver and excludes cancelled development effect replay. Optional initialization and disposer rejections are observed without escaping into the game lifecycle.

The Facebook adapter revalidates the connected surface and current SDK player after picture creation, name creation and show completion. Retirement after an admitted SDK operation cleans its original views. It does not start a subsequent name or show operation on a retired surface. Provider-owned identity remains opaque to shared game code; no profile fields are returned to the game.

## Reproduction

The minimized harness imports the actual `RaceTournamentEntry`, `PlatformPlayerOverlay` and `createFacebookOverlayCapability`. It injects the SDK's picture/name/view operations, separately holds creation and dismissal, performs native player/provider replacement, then releases the original operations. It renders synthetic SDK-owned labels only inside the fixture, without reading real profile fields. Global history and modal identities are independently observed.

The original selected source produces eight failures in both development and production: it reuses the old mount, issues late name/show operations and attaches retired views to the replacement presentation. Isolating surfaces eliminates stale presentation but leaves four obsolete-operation failures. Adapter phase validation eliminates the remaining failures. Final exact before-snapshot replays preserve the eight expected failures; the final source passes both modes.

The expanded maintained browser regression covers player replacement, provider replacement, render-method replacement on the same provider, ordinary profile updates, abandoned concurrent replacement, closure, SDK identity failure, picture failure, name failure and show failure. Each case releases original SDK operations, closes the game and proves every allocated view receives exactly one dismissal and destruction. Failures cannot cause unhandled browser errors. The SDK receives only the isolated mount marked as platform-owned.

## Verified scope

- 120 new cases, 1,512 assertions and screenshots across Chromium 153 and native Firefox 153, both development and production, at 390×568, 390×844 and 1280×844.
- 144 adjacent context-owner and chooser cases with 2,322 assertions across both Chromium modes.
- Four final minimized green cases with 36 assertions. Total final browser scope is 268 cases and 3,870 assertions; intentionally red baseline cases are excluded from that total.
- Three additional adapter regressions cover retirement after picture creation, SDK-player replacement after name creation, and retirement during an already admitted show. All eight overlay adapter tests pass.
- The complete portal run passes 2,905 tests, with 93 explicitly skipped tests; 301 suites pass and 15 are skipped.
- 23 built-artifact browser tests pass across Jest, Reddit and the injected Facebook fixture.
- Six isolated target builds and the Devvit server build pass. YouTube uses the fixture build, which does not certify partner release acceptance.
- Types, target boundaries, security configuration, documentation (26,631 declarations) and maintainable file-size checks pass.
- The final source freeze covers 2,458 selected inputs and five owned source records, each with before/after hashes and a reversible diff.
- Existing backend/Firebase SDK authority evidence is reused only after comparing all 824 selected inputs and 24 compiled core copies. Those integration suites were not freshly rerun for this client-only change; the changed Facebook overlay adapter is covered by the fresh portal suite and injected browser checks.
- All 17 final tracked jobs terminate, including the two intentionally red baseline runs. Final artifacts preserve 1,301 hashed output files, six isolated dependency inventories and the additional Facebook fixture inventory. Exact owned build roots, metadata and browser scratch directories are removed after preservation.

The first minimized name-count metric was refined to distinguish new-player name creation from old operations released later. The initial observations are retained under `red-initial-metric`. The first final Facebook built fixture also caught a mount-contract mismatch: the ownership marker remained on the wrapper while the SDK received its nested mount. The marker was moved onto the actual native surface, and the regression now checks each SDK creation's ownership marker. All 17 prior candidate jobs terminated; their artifacts, inventories and failure log are retained under `prefinal-sdk-surface-marker`. Their exact temporary build root and metadata were removed, followed by a new source freeze and complete verification run. Prior candidate results are not counted as final verification.

Run `python3 artifacts/live-overlay-owner-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifacts and cleanup. Firefox checks use the native executable and do not claim Firefox MCP coverage. No production visible text, score/reward authority, commit or deployment changed. The overall improvement goal remains active; the earlier multiplayer retirement callable/Devvit-route/TTL deployment prerequisite still applies before releasing those clients.
