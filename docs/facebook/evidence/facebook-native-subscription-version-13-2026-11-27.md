# Native subscription-gated ad check — Testing version 13

Riddle Quest Testing version **13**, bundle `29536858815945546`, was uploaded once from clean source `738d32a5b2628397d6ba365698d8c9abbd821358` on `facebook`. Meta completed processing and the candidate was assigned to Testing. The independent provider download matched SHA-256 `4f0f61b92bc08c9170bc6c4ec5dae0982cfc57e525511158b8969fba8e96c1cf` and 2,865,505 bytes. Exact-artifact acceptance was recorded. Production remained version 9, bundle `29168977262783270`.

See the [machine-readable acceptance record](facebook-testing-version-13-2026-11-27.json), [client correction and local tests](facebook-subscription-ad-gate-2026-11-27.md), and [ad eligibility contract](../facebook-ad-eligibility.md).

## Real desktop host result

1. Launched the exact Testing row with SDK **8.0 [Network Enabled Zero Permissions]**. Startup remained on its loader for an extended period, then restored the saved Classic coconut puzzle and **920 coins**. This verifies eventual startup, not a latency target. Dismissed the Riddle Quest welcome with **Let's Play**.
2. Entered five ordinary seven-letter incorrect guesses to reach **Out of Attempts**. The video action, 50-coin continuation and 100-coin skip controls were present.
3. Selected **Watch an ad for another attempt**. The controls became busy and Meta displayed a real native rewarded video.
4. Allowed the progress indicator to reach **100**. Closed the completed end card through its top-left X, whose accessible label was **Skip ad**. No advertiser link was opened.
5. The game returned with **seven editable answer cells**, no loss dialog and enabled **Multiplayer**. The balance remained **920 coins**. No coins were awarded or spent by the continuation.

No SDK replacement, request fixture, runtime state injection, live subscription mutation or backend deployment was used. The normal guesses and rewarded continuation changed gameplay state through existing services. No invitation, message, purchase, account deletion, notification opt-in, Production promotion, publication or review submission occurred.

## What the result establishes

The reviewed, hash-matched client permits native acquisition and display only after fresh combined configuration and entitlement reads. Successful native display therefore establishes that this nonsubscriber passed those gates on the real host. This is an inference from the reviewed control flow and observed outcome, not a captured HTTP transcript.

Direct observation of the nested game frame's entitlement GET was unsuccessful: the available browser trace exposed outer frames, and the separate Chrome debugging connector could not connect. No claim is made that the live request headers, field mask, response status or response body were directly inspected. Those wire-contract properties were verified at the controlled external boundary in local tests. Network observation was disabled after the check; credentials and account document identifiers were not recorded in this evidence.

The local tests cover subscriber suppression despite permissive legacy flags, unknown-state recovery, resume freshness and subscribing during native preparation. They do not establish live subscriber behavior for an account that was not tested. Native mobile, two-account co-play, optional provider features and the full backend/review gates remain open. The preserved active configuration endpoint still lacks its own subscription check; this candidate adds a client restriction without repairing or redeploying that backend.
