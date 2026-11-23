# Recorded race entry compatibility — 2026-10-05

Status: complete and verified for this pass. Goal remains active.

Recorded-entry readers could advertise incompatible original questions as ready and bind a private recipient seat before gameplay rejected the recording. The older challenge-preview callable also used separate claim and metadata transactions and bypassed user-aware public admission.

The fix validates the original frozen deck before fresh readiness or dependent seat writes. Modern snapshots keep their original content/version; legacy archives hydrate through the caller's existing Firestore transaction. No mutable catalog substitute, content repair, answer rewrite or automatic seat release is introduced.

A canonical player/challenge attempt plus its validated original challenger run authorizes accepted recovery. A previously reserved seat alone does not. Recovery pointers remain negotiated and owner-bound. Creator typed readiness, pending invitations, private cancellation and public expired/revoked metadata retain their respective contracts; strict malformed stored records now return typed invalid readiness.

The legacy callable delegates to the same authenticated resolver. Successful private previews now use one real SDK admission transaction, observed in four public/private modern/legacy controls. Authentication and the existing account-operation lease remain outside this count. This is a transaction-boundary improvement, not a measured network-latency claim.

## Reproduction and controls

The corrected baseline was 46 failing and 24 passing SDK cases. Four failures involved modern oversized clues that already failed strict stored parsing; these were exceptions instead of typed invalid readiness. The other failures exercised missing content admission, dependent seat writes and original-archive reads. Four callable boundary tests also failed before the user-aware delegate was wired.

There are 90 dedicated SDK cases across modern embedded and legacy archive formats; public and exclusive scope; current/future malformed questions; default/negotiated entry; deprecated claims; and the legacy preview. They cover whitespace slots, oversized answers/clues, supported English/French NFD/Hindi input, truthful completed recordings, accepted scoring/resume and exact receipt identity, pending publication, claimed-but-unaccepted seats, concurrent winners, creator mismatch, provider/block/deletion precedence, storage-read failures and closed recordings.

The controls inspect actual document versions, original deck bytes, profiles, attempts, run counts, match profiles and request receipts. Across 32 retained baseline observations, 22 changed the private seat state/version. Across 60 captured fixed observations, none changed it. The 92 original traces have a retained SHA-256 inventory.

Infrastructure errors propagate. Only expected structured content/storage-validation errors are classified as unavailable. No answers or private player IDs enter entry/preview responses.

## Verification

Passed on the retained frozen inputs:

| Check | Result |
| --- | --- |
| Backend unit tests | 1,705 / 136 suites |
| Real emulator integrations | 637 / 33 suites, including all 16 original invitation lifecycle cases |
| Pinned Functions Node 22 | All 90 focused SDK cases |
| Core tests | 374 / 38 suites |
| Focused client tests | 127 / 9 suites |
| Built injected browser harnesses | 8 / 3 suites, Jest and Reddit |
| Types and backend lint | Core, client and Functions typechecks; backend lint passed |
| TSDoc | 26,337 declarations across 1,177 files |
| Isolated builds and artifact audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo |

The report verifier passed against 2,384 stable source inputs, 24 compiled/installed core hashes, the reversible seven-file owned diff, trace hashes and every terminal job. All 28 recorded parent jobs reached actual terminal states; retained failures have explicit corrections. The final corrected SDK fixture changed only its deletion-error matcher, so unit, client and build inputs remained identical.

All 1,300 built files and six dependency inventories were preserved and hash-verified before deleting only the owned temporary output root and its matching inventories. The five owned emulator ports were closed. YouTube used an incomplete-content fixture and is not release certification.

## Retained diagnostic corrections

- Four initial accepted controls incorrectly compared replay clocks. They were corrected before the production fix to check retained identity/content and single receipts.
- The source transformation initially resolved TypeScript from the repository root; it was corrected to the installed Functions package.
- An initial typecheck emitted two diagnostics; its wrapper later exited successfully on callable tests, so the child typecheck exit is unknown. Separate corrected typechecks passed.
- Four first green SDK cases exposed strict modern oversized-clue parsing. The known parser error now becomes typed invalid readiness; creator controls distinguish structurally invalid metadata.
- The proxy getter needed a documentation comment before source freeze.
- A ledger-generation command inserted JSON directly into Python and failed before writing. It was corrected with JSON parsing.
- The first broad SDK run passed 635 of 637 cases. Two newly added deletion controls expected a transport error directly from the domain service. They now assert its existing `account-deleted` sentinel; the callable wrapper retains deleted-account transport handling. All other source hashes are identical across the correction.

All failed outputs, terminal exits, corrections, original source snapshots and the owned diff are retained. No source/runtime defect was hidden by restarting a still-running job or changing its observation deadline.

## Evidence and limits

Evidence: [`artifacts/race-entry-compatibility-2026-10-05`](../../../../artifacts/race-entry-compatibility-2026-10-05/). Only the four production files and three test files listed in `owned-files.json` belong to this pass; other shared checkout changes were preserved. No commit, push, deployment or production data mutation was performed.

No network latency, provider certification or YouTube release certification is claimed. Client input and glyph layout are unchanged in this pass; the previous native Chromium/Firefox evidence remains separate. The goal is not exhausted. Bounded Unicode work during fresh catalog validation remains a candidate for measurement in the next pass.
