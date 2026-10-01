# Multiplayer reward acceptance

30 September 2026 local development evidence. Scope remains named HTML5 platform
builds; standalone web/PWA releases remain excluded. No production data,
deployment, visible UI text or translations changed.

## Reproduced unsafe grants and acknowledgement

Nine initial public-interface demo-emulator regressions proved committed effects
before this fix. Negative, fractional, string, null, NaN and infinite balances were
normalized or coerced during settlement; an unsafe reward sum also committed.
Some outcome responses were rejected only after balances, achievement progress,
outboxes and presentation acknowledgements had changed. A negative balance even
returned currency disagreeing with the actual persisted grant. Resume could
silently overwrite a malformed balance without requesting an outcome.

A settled run with an unsupported optional award identifier consumed its pending
presentation acknowledgement before public decoding rejected the response. Its
next read therefore could not recover the original award presentation. These
reproductions used isolated synthetic records, not production accounts.

The first publication fixture lacked its completed deck and failed before reaching
the grant writer; that was a fixture error, not evidence of a publication leak.
The completed fixture now verifies publication rejection through the actual shared
grant writer. The first creator-delivery recovery expectation also incorrectly
expected rejection; permanent failures intentionally quarantine and return false.
The corrected test verifies the quarantine and actual absence of partial writes.

## Currency authority and public acceptance

The shared persisted race achievement writer now checks the canonical account
balance without coercion before calculating a grant. Present balances must be
nonnegative safe integers, and the resulting balance must remain safe. An absent
historical balance retains its supported zero default. This covers owner
settlement, recording publication and creator delivery; malformed balances are
never silently overwritten as zero. The pure achievement calculator retains its
existing normalization for compatibility, while persistence enforces currency
authority before it can write.

Outcome projection validates inside the transaction before consuming reward
presentation. Supported achievement identifiers must be unique and the award
total must match their fixed unlock reward. Public currency and the complete
outcome contract must pass strict decoding. Bounded data-loss errors omit stored
diagnostics. Transport sanitization also occurs before transaction commit.

Pending rewards use the current canonical balance, adding only a newly staged
grant. Already-settled presentation includes accepted intervening purchases or
other balance changes without granting the reward again. Rejection leaves the
pending acknowledgement available after explicit authoritative repair.

Creator currency failures use the existing durable quarantine mechanism. The
failed transaction creates no inbox item, social linkage or achievement progress;
the source and outbox remain available for guarded repair/replay within their
original retention period. Repeated delivery cannot repeat a repaired grant.

## Verification

Eighteen public-interface emulator cases cover malformed/overflowing balances,
unsupported and duplicated reward identifiers, inconsistent award totals, resume
and publication writers, repaired concurrent settlement/presentation, absent
legacy balances, zero grants at the safe-integer limit, current balances after
prior settlement, and creator quarantine with repaired idempotent replay.

Final stable-source recording uses
`docs/development-tasks/race-reward-acceptance.json`: compiled Node 22 backend and
operator safeguards, complete race coverage, backend types/lint, client recovery,
seven isolated target artifacts and dependency audits, security, scalability,
source-size and TSDoc checks. Its local progress-dashboard receipt establishes
this finite change; the comprehensive reliability goal remains active.
