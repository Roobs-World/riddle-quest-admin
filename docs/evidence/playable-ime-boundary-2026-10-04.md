# Self-contained single-player IME key ownership — 4 October 2026

The shared Playable native answer input handled key-code 229 Enter and Backspace as ordinary game commands when `isComposing` was false. A minimized actual-app reproduction showed an IME boundary Backspace deleting `ROM` to `RO`. A second original-source control showed boundary Enter submitting `ROME`, displaying a win, and writing save revision 2 with one recorded guess and win. Hosted solo and live multiplayer input already guarded this marker.

`YouTubeNativeAnswerInput` now leaves these boundary keys to the native editor, alongside its existing `isComposing` and active-composition guards. YouTube, Netflix, and Yahoo use this shared Playable component. Ordinary Enter, Backspace, software deletion, committed composition, and Escape retain their existing behavior. No provider capability, save policy, local reward, or visible copy changed.

## Verification

Evidence is under `artifacts/playable-ime-boundary-2026-10-04`; `verification-summary.json` records asserted results and source hashes.

| Check | Result |
| --- | --- |
| Exact original-source controls | Backspace deletes a letter; Enter submits and saves a win |
| Actual-app injected matrix | 336 checks across 54 journeys, development and production React with Strict Mode wrappers |
| Viewports | 390×568, 390×844, 1280×844 |
| Scenarios | Key-code 229 Enter/Backspace, explicit composing Enter/Backspace, ordinary Enter/Backspace, software deletion, composition with duplicate trailing input, and Escape |
| Firefox MCP | Boundary events preserved `ROME`, one initial save, and no result; native ordinary Backspace and Enter then edited and submitted once |
| Full portal units | 2,707 passed across 296 suites; 121 browser cases intentionally skipped in this run |
| Types and TSDoc | Passed; 25,105 documented declarations across 1,136 files |
| Built Playable journeys | 15 passed across three suites covering YouTube and both standalone candidate artifacts |
| Six target builds and audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Compiled guard | Present in the final YouTube, Netflix, and Yahoo entry modules |
| Source stability | All 763 build input paths and content hashes unchanged through final verification |

The regression mounts the actual shared `YouTubePlayableApp` and its local authority with the approved bundled content fixture and an injected SDK port. It checks visible drafts, event ownership, result presentation, material save counts, and errors at the mounted UI seam. The original input source can be substituted through `PLAYABLE_IME_BASELINE_FILE` to reproduce both failures. `test:playable-ime-boundary:browser` runs both React modes and is included in the existing browser chain. No shallow implementation-mirroring unit case was added.

The Firefox proof used the active MCP connection at 390×568. Injected boundary KeyboardEvents reported key-code 229 and remained unconsumed. Native MCP typing, Backspace, and Enter verified ordinary interaction: the boundary keys did not mutate or save the draft, ordinary Backspace deleted exactly one letter, and ordinary Enter produced one win and one additional material save. Raw and parsed results are in `firefox-mcp-proof.json`. The verification tab and owned fixture process were closed; the original Firefox tab remained open.

IME events were injected and do not certify every operating system's keyboard. The built suites independently cover actual target lifecycle, input, persistence, and currency boundaries. All provider isolation rules remained intact, including YouTube save-after-load and the absence of multiplayer, identity, ads, Firebase, and other provider SDKs in the self-contained artifacts. No deployment or commit was performed. The wider improvement goal remains active.
