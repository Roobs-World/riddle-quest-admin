# Race content query payload and playable identity — 5 October 2026

Race deck and category loading now query only the eight fields used by their current consumers: riddle ID, canonical ID, clue, answer, category, difficulty, eligibility and quality version. Locale/category/eligibility filters, snapshot document paths, pool size checks, duplicate detection, difficulty selection, deterministic ordering and content version remain unchanged. Content migration uses its separate loading path and retains legacy metadata.

The audit also found that category readiness did not validate `riddleId`, although published prompts require it. Missing or invalid IDs could therefore offer a category that failed later, and a padded ID could be normalized in the public prompt while private authority retained a different string. Pool validation now uses the existing published prompt ID schema and requires its parsed ID to equal the original value. Missing, blank, whitespace-only, padded, oversized and non-string IDs fail the existing `missing_metadata` check before a category is offered or a deck selected. No IDs are rewritten and no public fields or visible text are added.

## Matching reproduction

Twenty cases use the actual Admin SDK and a private loopback demo Firestore emulator. Each eligible synthetic document contains an unused 100,000-character field. An observer forwards the original query execution, then measures actual returned document data, loaded fields, count and query calls.

| Query | Documents before and after | Decoded JSON before | After |
| --- | ---: | ---: | ---: |
| One category's deck pool | 30 | 3,007,881 bytes | 7,371 bytes |
| Two categories for availability | 60 | 6,015,521 bytes | 14,501 bytes |

Each path retains one query call. Sizes measure decoded document-array JSON, excluding wire encoding and metadata. Synthetic unused fields do not establish typical production document sizes, billing savings or measured production latency.

The matching old-source SDK suite fails two payload assertions and six identity controls, while twelve other controls pass. Projection alone resolves the payload cases and leaves exactly the six identity failures. Schema-based identity validation resolves those; all twenty pass. Six new unit cases independently reproduce the identity problem through the real deterministic deck builder: the old implementation fails all six and passes its six existing controls.

SDK controls compare the projected deterministic deck with one built from an independently loaded unprojected catalog, including exact order, answers, difficulty and content version. They retain ten easy and five medium questions. Category and locale boundaries, ineligible content exclusion and valid live-seat creation stay intact. Other cases retain rejection of missing quality metadata, duplicate clues/answers/canonicals, literal answer leaks, oversized answers, insufficient/oversized pools and unsuitable difficulty balance. Invalid eligible documents remain available to validation even if a selected field is missing; projection does not silently discard them.

The catalog-retry unit transport gained a `select` seam while retaining one original catalog RPC across callbacks. Actual projection behavior is proven by SDK snapshots, not that adapter. The initial SDK/unit probes covered three basic bad IDs. After tracing the shared prompt schema's trimming and 160-character bound, the matching probes were expanded to all six identity cases; the earlier narrower probe logs are retained separately.

## Verification

- **1,653 backend unit tests / 134 suites passed**.
- **334 Firestore/Realtime Database emulator tests / 22 suites passed**, including twenty new content cases and existing multiplayer, invitation, rematch, identity, settlement, deletion, provider and single-player controls.
- **47 focused tests / four suites passed**, covering content validation/import, deterministic decks and live-action timing.
- Backend TypeScript, targeted lint and TSDoc passed: **25,954 declarations / 1,160 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,358 freshly enumerated source inputs** stayed unchanged through final verification, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 23 tracked jobs are terminal and owned emulators stopped.

Evidence is in `artifacts/race-content-query-payload-2026-10-05/`. No final gate failed. `report-generation.py` validates matching old/projection-only/fixed query traces, identity failures and final regression results, frozen-source hashes, preserved artifacts, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. The broader improvement goal remains active; no deployment was made.
