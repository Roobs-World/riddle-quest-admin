# Native navigation preserves composition delivery — 4 October 2026

In both actual games, a native navigation key could make an already committed composition appear twice. The single-player reproduction committed `ro`, pressed native ArrowLeft and delivered a matching trailing input: the draft became `roro` instead of remaining `ro`. Multiplayer similarly changed `te` to `tete`. The native buffer was already empty before the key, and omitting only that key made the original local game complete a normal win. The captured original also failed with production React.

Both native editors previously cleared their trailing-input marker for every admitted keydown. They now retain it across navigation and modifier keys, while the ordinary text-key, Backspace and Enter paths still retire it. Software editing continues to use the existing native beforeinput listener, and paste/composition starts retain their existing behavior. Default-prevented, isComposing and 229 guards are unchanged.

## Verification

Artifacts, captured original editors, failing reproductions, positive controls, source diff, raw Firefox observations and an asserted summary are in `artifacts/native-navigation-tail-2026-10-04`.

| Check | Result |
| --- | --- |
| Original single-player ArrowLeft then trailing input | `roro`, expected `ro`; reproduced twice and with production React |
| Original multiplayer sequence | `tete`, expected `te` |
| Original local control omitting only ArrowLeft | Prefix retained; one complete win |
| Original fresh matching-text controls | Local and multiplayer accept a new physical edit matching the earlier commit |
| New actual-game matrix | 1,872 assertions across 156 journeys |
| Matrix scope | Both games; development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844 |
| Keys covered | Four arrows, Home, End, Shift, Control, Alt, Meta, Tab, Shift+Tab, and a fresh physical-text control |
| Existing composition delivery | 1,080 assertions pass |
| Existing composition retirement | 408 assertions pass |
| Existing canceled native keys | 396 assertions pass |
| Existing local IME boundary | 336 assertions pass |
| Existing race IME/dialog | 348 assertions pass |
| Existing multiplayer action focus | 684 assertions pass |
| Existing rapid editing | 768 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing single-player action focus | 462 assertions pass |
| Total injected browser assertions | 6,660 pass |
| Portal units | 2,724 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,166 documented declarations across 1,138 files |
| Target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo pass |
| Source stability | Recollected 765-path source/build-input inventory and hashes match before/after verification |

The new `test:native-navigation-tail:browser` command runs both React modes in the existing game browser chain. The fixture mounts the actual single-player app and a two-human live race through target-owned adapters. It checks one committed prefix, an empty consumed native buffer, deduplication after native keys, preservation of navigation-selected focus, fresh subsequent input, absence of editing-triggered guesses or material saves, and one explicit Enter completion. The fresh-text control deliberately enters the same prefix again, verifies acceptance, removes that new edit using ordinary Backspace, and finishes the answer. Existing regression observations are saved inside this pass's artifact directory and individually checked against their expected values.

## Firefox MCP

At 390×568, native Classic selection opened the local game. Injected composition committed `ro`; native ArrowLeft followed by an injected matching trailing input preserved `ro`, an empty native buffer, focus and the single start save. Native `me`, without an input UID or refocus, produced `rome`; native Enter produced one win, one result and one additional save.

Native Start and slot controls opened the two-player fixture and focused the multiplayer editor. After injected composition committed `te`, native Tab selected the Q shortcut. The injected matching trailing input retained `te`, kept that exact shortcut focused and sent no guess. Native Shift+Tab returned to the editor, native `st` completed `test`, and native Enter sent exactly one answer and advanced once. Eight raw and parsed observations were asserted before the proof was marked verified. All three owned tabs and the owned fixture were closed; the original blank tab remained open.

## Scope

Composition and trailing input are deliberately injected around genuine browser key operations. This proves resilience to that delayed-delivery pattern; it does not certify an OS IME or establish that an ordinary browser emits this ordering. No production network latency, frame-rate or throughput claim follows from these tests.

React review keeps transient ownership in the existing refs and the decision in the event handler. The change introduces no state, effect, listener, timer, segmentation or allocation. Input metadata, focus ownership, local pause retirement and ordinary beforeinput editing remain intact. There are no changes to visible copy, locale keys, SDKs, persistence, economy authority or multiplayer transport. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
