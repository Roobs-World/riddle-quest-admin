# Smaller Classic supply query payloads — 5 October 2026

The supply check awaited by Classic wins and skips now selects only `classicIndex` from its highest-index catalog query. The scheduled worker's due-job discovery selects document IDs only, because each claim transaction already reads the canonical job independently. Unused riddle text, private answers, provenance and copied job fields are no longer loaded by these two discovery queries.

Both paths keep their original filtering, ordering, limits and one query. The supply threshold, empty-catalog sentinel, locale isolation, durable create-only job identity and duplicate handling are unchanged. Worker claim/settlement reads, transaction eligibility, canonical locale validation, leases, generation inputs and completion/backoff behavior are unchanged. There is no cache or reuse of discovery data as an authorization grant.

## Matching reproduction

Eight actual Admin SDK/Firestore emulator cases measure payload and check replenishment behavior. Observers forward the original query methods and return genuine SDK snapshots. Field filtering is performed by Firestore, rather than a fabricated snapshot seam. Synthetic catalog text and each synthetic due job's unused field contain 100,000 characters.

| Query fixture | Decoded document JSON before | After | Queries |
| --- | ---: | ---: | ---: |
| Highest catalog index, one riddle | 100,084 bytes | 21 bytes | 1 → 1 |
| Due-job discovery, three jobs | 300,235 bytes | 10 bytes | 1 → 1 |

The fixed catalog result contains its selected index. The fixed discovery result has three empty field maps (`[{}, {}, {}]`); genuine SDK document IDs remain available and drive the unchanged claim transactions. These measurements cover decoded synthetic query payloads, not wire bytes, production content distributions or production request latency. The worker's subsequent canonical transaction reads still load job state and are outside the discovery-payload measurements.

The matching old implementation fails both payload cases, with six behavior controls passing. Selecting the catalog index fixes only the catalog case; the intermediate suite has one failure and seven passes. Selecting only due document IDs resolves the remaining case, and all eight pass:

- Threshold boundaries retain the existing decision at two, one and zero remaining Classic riddles.
- Another locale, missing Classic index and negative index cannot become the requested locale's highest Classic content.
- An empty catalog retains its existing `-1` replenishment identity.
- Four concurrent and repeated low-supply requests preserve one durable job without overwriting its timestamp or fields.
- Discovery retains due filtering, ordered IDs and the three-job limit; each genuine claim transaction uses the canonical locale and leaves a future job and fourth candidate untouched.
- A competing lease written after discovery prevents generation when the claim transaction rechecks current authority.

The existing unit suites gained selection assertions and three worker discovery controls. The matching 18-case unit reproduction fails two mask assertions on the old source. The fixed focused gate also includes real skip/completion timing fixtures and completion transaction controls.

## Verification

- **1,640 backend unit tests / 132 suites passed**.
- **269 real Firestore/Realtime Database emulator tests / 17 suites passed**, including eight new supply cases and the existing multiplayer, completion, skip, deletion and referral controls.
- **54 focused tests / five suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,759 declarations / 1,153 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,351 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 14 tracked jobs are terminal, including the two expected red/intermediate SDK probes, and owned emulators stopped.

No final gate failed. Evidence is in `artifacts/classic-supply-query-payload-2026-10-05/`. `report-generation.py` validates matching old/intermediate/fixed payload traces, regression counts, source stability, preserved artifact hashes, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. The broader improvement goal remains active; no deployment was made.
