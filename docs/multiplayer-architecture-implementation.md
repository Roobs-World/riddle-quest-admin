# Multiplayer architecture implementation

This implements the full 29 September 2026 matchmaking architecture review. The working tree already contains other architecture and platform work; preserve it. Development completion requires implementation and evidence for every item below, independently of deployment or provider publication.

## Requirements and evidence

- [ ] MP1 — One idempotent settlement path for mutation, resume, outcome reads, and unattended deadlines. Persist canonical outcomes; map creator results from outcome enums; preserve deletion/blocking policy; award rewards exactly once.
- [ ] MP2 — Shared discovery/acceptance eligibility: provider scope, language, rules/content compatibility, active account/challenge, self exclusion, prior attempt exclusion, bidirectional blocks, invitation authorization. Acceptance revalidates transactionally.
- [ ] MP3 — Indexed candidate projection, correct pool filtering before candidate limits, bounded pagination, stable retry offers, failure classification, and matchmaking operational measurements.
- [ ] MP4 — Prepared/scheduled/active/terminal lifecycle, idempotent server-controlled start, synchronized countdown, late/background behaviour, and pre-start mutation rejection.
- [ ] MP5 — Immutable challenge deck and rules snapshots, referenced-content retention, and server-enforced answer exposure policy preserving the accepted casual experience.
- [ ] MP6 — Provider-neutral recorded-match contracts and authenticated scope adapters; performance/confidence/category scoring, repetition/exposure penalties, bounded widening, and fixed-ghost performance attribution.
- [ ] MP7 — Typed invitation lifecycle with independent claim/publication states, expiry/cancellation/recovery, visibility-aware polling/backoff/jitter, and no client provider-prefix/error-text interpretation.
- [ ] MP8 — Observable client race-session lifecycle ownership, stale response invalidation, and integration with the existing RacePlay projection module.
- [ ] MP9 — Durable deterministic settlement outbox and idempotent delivery for creator inbox/rewards and downstream projections, keeping authorization/scoring authoritative.
- [ ] VERIFY — Focused behavioural regressions, transaction/emulator tests, relevant type/lint/security/index checks, all required isolated target builds, injected browser flows, and final requirement-by-requirement audit.

The optional future synchronous mode and additional product modes were examples of later extensions, rather than requirements of this architecture implementation. Existing provider capability restrictions remain applicable.

## Progress

- Baseline: inspected current working source; existing unrelated changes recorded outside the repository. Original review findings revalidated against settlement, discovery, preparation and client paths.
