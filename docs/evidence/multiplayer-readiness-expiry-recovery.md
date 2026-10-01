# Multiplayer readiness expiry recovery

30 September 2026 local development evidence. Release scope remains named HTML5
platform artifacts, excluding standalone web/PWA builds. No UI copy, translations
or production data were changed by this correction.

## Reproduction

Eight public-interface emulator cases reproduced blocked expiry cleanup: legacy
and versioned owned prepared runs could not abandon at their preparation deadline
when their mutable source challenge was missing, malformed, revoked or expired.
The source was read and admitted before expiry was considered. Preparation remained
pending, including accepted offer attribution. The initial focused test invocation
used the unit-only configuration and found no integration tests; it was corrected
to the race configuration. Two initial negative expectations also assumed data-loss
for a malformed archive; its existing public parser returns internal instead.
Those expectations were corrected without changing admission error behavior.

## Correction

The readiness module now checks owned preparation expiry after ownership, account,
opponent privacy, interaction and offer reads, before mutable challenge admission.
Expired cleanup strictly projects the abandoned response before committing run and
terminal offer facts. Concurrent retries retain one cleanup clock and do not start
a countdown, grant currency or create settlement/performance delivery. The source
archive is neither recreated nor repaired. Unexpired readiness still validates
source availability, eligibility and immutable recording facts. The final clock is
sampled again after reads, preserving the full countdown lead-in and preventing
scheduling if preparation expires during those reads.

## Verification

The new integration suite checks 24 cases: concurrent expiry and later replay for
four source failures in both record versions; unchanged run/offer on pre-expiry
rejection; valid pre-expiry scheduling; and owner, block and strict response guards
at expiry. All 42 focused checks passed, including existing readiness, response acceptance
and rules checks. The first complete recording reached its final TSDoc gate and
rejected five missing declaration comments: three new test locals and two fields
in shared read-meter code. Comments were supplied without changing read-meter
behavior; the focused TSDoc audit passed before a fresh complete verification.

Stable-source verification is declared in
`docs/development-tasks/race-readiness-expiry-recovery.json`: Node 22 backend and
operator safeguards, full race coverage, backend types/lint, client recovery,
seven isolated artifacts and dependency evidence, security, scalability, source
size and TSDoc checks. Only a successful recorded handoff updates the local
completion dashboard. Production deployment requires separate evidence, and the
comprehensive multiplayer reliability goal remains active.
