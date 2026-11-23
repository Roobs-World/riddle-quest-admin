# Facebook live context recovery — 2 October 2026

The Live PvP migration left the existing Facebook context and overlay capabilities composed but unreachable. The context recorder also accepted only the retired recorded-race store. This follow-up restores those local integrations; it does not establish Meta-hosted acceptance or authorize release.

## Reproduction and changes

- `recorder-baseline.log` contains two real-engine failures, one for each winning seat: `Facebook context race run was not found`. The fixed recorder resolves private live tickets/matches through the existing Facebook winner resolver and independently frozen creator deck. Recorded runs remain compatible. Active membership, exact locale, the original seven-day window, authoritative completion and best-time idempotency remain enforced. A submission cannot precede its server completion. No economy grant occurs in context recording.
- `browser-baseline.log` reproduces the absent native chooser in the fresh production artifact. The shared race entry now exposes Activity only through the context-board capability, and invokes the owning target's native context chooser. It contains no provider SDK import. Reddit retains Play/Tournaments; Jest does not use this entry. Context scoring and tournament scoring are independent optional completion effects.
- The chooser has a synchronous duplicate-click barrier and retains the SDK-instance dialog guard. Tab changes retire late failure feedback. An accepted context invalidates old standings, and the board bounds reads, validates locale, rejects late responses after retirement and offers localized retries. Current-player overlays are mounted only on Activity/Tournaments and cleaned when their surface retires.
- Meta MCP documentation exposed an overly strong local overlay type: `destroyAsync` was mandatory although the documented Zero Permissions lifecycle guarantees show/dismiss. `overlay-contract-baseline.log` reproduces the type mismatch using a minimal documented view. The destruction hook is now an optional runtime extension; ordinary views are dismissed and their game-owned container leaves the DOM. Neither this change nor injected lifecycle counters proves provider memory reclamation. A typed SDK-shape fixture and adapter case verify that no extension is required.
- Existing translations are reused. Context-specific list styles show one explicit competition rank beside its time. `context-mobile.png` retains the inspected French mobile result.

## Checks

- Real loopback demo Firestore emulator: **44 tests, six suites**, including eight context-board cases, context membership, Facebook/Reddit official recorders and both live tournament delivery paths. New cases use the production live engine and both seats; concurrent submissions converge once without another grant. Expiry, future submission, late membership and a corrupted creator source are rejected before a new entry or economy change.
- Functions unit regressions: **33 tests, five suites**.
- Focused platform regressions: **173 tests, eight suites**, including Facebook context/overlay/bootstrap/tournament policy, Jest, Reddit and YouTube adapters.
- Complete Portal unit run: **2,236 passing tests, 264 passing suites**; 116 browser tests in 15 suites remain skipped by the unit invocation. This is not the complete Jest browser acceptance suite.
- Fresh injected Facebook artifact journey and retained isolated Reddit artifact journey pass. Facebook checks double clicks, stale native failure after tab reentry, selected-context replacement, social overlay lifecycle, opaque eligible live-win recording with tournaments both enabled and disabled, and no context recording for loss/tie/nine-solve forfeits. These HTTP/SDK fixtures are synthetic, not provider role-account acceptance.
- All **six owned target builds and explicit output-directory audits** pass: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. YouTube/Netflix/Yahoo remain bundled-content preparation artifacts; build success does not complete their content or partner release gates.
- Functions types/lint, TSDoc, production module-cycle audit and private compiled Node **22.23.1** module loading pass. The overlay shape checker passes after the fix. No runtime HTTP request is needed for that check.
- `manifest.json` binds owned source, output-tree and evidence hashes. Builds ran in the shared dirty tree while other chats were working; they do not prove an atomic final-source snapshot. `uploadEligible` remains false.

## MCP and provider scope

Fresh authenticated Meta MCP app-list and basic-settings reads confirmed **Riddle Quest / 1748953042991569**, viewer role admin, caller permission **read**, app status **dev_mode**, and **is_live=false**. Only this sanitized app summary is retained in `meta-read-scope.json`; other apps, pagination cursors and contact details are omitted. No app setting was changed.

The official MCP documentation search returned the current [v8 overlay reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews) and [Zero Permissions API reference](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference). The latter documents the context chooser and provider-controlled identity overlays. Direct web-tool opens were unavailable, so the MCP search is the documentation evidence. The documented overlay lifecycle is treated conservatively; no unsupported destruction method is required.

## Remaining work

Context scores still depend on the browser's optional completion submission. The existing durable official-tournament recovery does not bind a native context at live join; do not invent a context during background delivery or claim closed-browser context recovery. The native chooser selects a scoring/social context; it does not guarantee that the global Live PvP queue matches the selected friend. The old native matchmaking hint is not represented as a scoped live opponent contract.

Meta-hosted THREAD/GROUP role-account and web/mobile acceptance, context cleanup deployment/physical retention, and exact hosted overlay lifecycle remain external gates. The retired recorded-race history/safety surfaces still require review against the Live PvP UI; the new Activity destination exposes context standings rather than that retired inbox. Purchases require accepted signed purchase/refund verification and payout readiness. Rewarded currency requires server-verifiable reward authority; native video completion alone is insufficient. First-win bot prompts are locally wired and regression-tested, but actual hosted/device consent acceptance and server reminder delivery remain unverified. No deployment, upload, live purchase or player notification occurred.
