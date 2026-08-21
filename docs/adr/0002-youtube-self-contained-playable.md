---
status: accepted
---

# Keep YouTube Playables self-contained and platform-local

Riddle Quest will ship YouTube as a separate Web Target containing its content and using only YouTube's Playables SDK for lifecycle, locale, audio, and Playable Save data. It will not join the Global Game Account or call the game backend because YouTube certification requires a self-contained bundle without external game traffic; local progression and the Local Play Balance therefore have no value or authority outside this target.

## Considered options

- Reusing Firebase identity and game services was rejected because the public Playables requirements prohibit those external calls.
- Treating browser storage as a fallback was rejected because progress must remain in the provider save boundary and load must succeed before any save.
- Delaying the target for a partner-only remote-data pilot was rejected in favor of a submission-ready public-contract implementation.

## Consequences

- Content generation and translation happen before release and produce a Bundled Content Pack; the running game never requests new riddles remotely.
- Identity, purchases, sharing, multiplayer, custom telemetry, and cross-platform progression are Capability Gaps and their surfaces are absent.
- Concurrent devices follow the provider's last-writer-wins behavior; no global account reconciliation is implied.
- Daily selection uses device UTC because the public SDK exposes no trusted platform time; completion guards prevent clock rollback from replaying a rewarded day but cannot make the device clock authoritative.
- This decision must be revisited if YouTube grants a production remote-data capability with an approved trust and certification contract.
