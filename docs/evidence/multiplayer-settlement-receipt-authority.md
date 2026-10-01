# Multiplayer settlement receipt authority

30 September 2026 local development evidence. Scope remains named HTML5 platform
artifacts, excluding standalone web/PWA releases. No production data, deployment,
visible UI text or translations changed.

## Reproduced contradictions

Thirteen public-interface demo-emulator regressions failed before this change.
Grant markers before a possible finish suppressed earned completion progress;
presentation markers without settlement suppressed pending awards. Retained awards
without a grant receipt could present currency which had never been granted.
Canonical reusable outcomes accepted one-time reward fields. Inconsistent grant,
settlement and acknowledgement ordering passed validation, and a read sampled
before an accepted settlement recorded its acknowledgement before the grant.

A legitimate old active run with an expired ghost and recorded grant could reopen
as active when resume sampled an older clock. Historical code at commit
`598aeee9` granted outcomes while retaining active storage and recorded only
`achievementProgressRecordedAtMs`; its engine applied the maximum duration to
both creator and challenger roles. This is supported history, not a record to
silently reject or pay again.

## Known markers constrain settlement

Canonical storage now requires grant progress to follow an actual terminal
occurrence and every known accepted action. Modern versioned grants require a
settlement receipt. Known settlement clocks follow all accepted actions; known
grant clocks cannot exceed settlement. Acknowledgement requires settlement and
cannot precede its grant. Retained awards require a grant receipt, supported unique
achievement identities and their exact fixed reward amount. Award validation is
shared with public outcome acceptance in the achievement module.

The reusable canonical outcome remains reward-free. One-time identifiers, amounts
and balances belong to the separate grant/presentation receipt, preventing reward
presentation from leaking into subsequent ordinary outcome reads.

The accepted operation clock includes settlement, historical grant and later
presentation clocks. Backdated requests cannot reverse those accepted facts.
Supported sparse legacy terminal grants and settlement acknowledgements remain
readable; missing historical metadata is not invented.

## Historical recovery

Unversioned active grant history is supported only when its retained immutable
rules, penalties and opponent deadline prove that the old outcome could already
have been terminal at the grant time. Prepared, scheduled, abandoned and early
active grants are rejected. Modern versioned active grants cannot downgrade into
this historical path.

Recovery determines an already-granted legacy result at its original grant clock,
even when the present clock has advanced past a later maximum. Its accepted result
therefore cannot change from ghost loss to timeout during late recovery. Old
creator maximum-time grants recover their prior timeout; modern untimed creator
recordings continue running under their existing rules. Recovery records canonical
settlement and downstream outboxes without granting owner progress again.

## Verification

Nineteen public-interface emulator scenarios cover inconsistent grant/presentation
markers, reusable outcomes containing reward fields, settlement before an accepted
penalty-clamped action, early grants and modern attempts to use old history,
backdated acknowledgement/resume, legitimate old ghost and creator recovery,
legacy terminal grants and durable deadline quarantine/repair. Paid-hint repairs
retry the original rejected command and charge/grant exactly once. Deadline replay
rejects invalid repair, then settles a corrected marker once without repeated
currency. Twelve canonical-reader/clock tests additionally cover sparse legacy
metadata, unfinished lifecycle states, zero-award proof and later presentation
clock floors.

The first broad run passed these emulator scenarios but encountered two read-budget
failures while another chat implemented transaction snapshot reuse in the shared
checkout. That independent implementation is preserved and is not attributed to
this receipt-authority change. Final verification covers the combined current
source after those changes.

Stable-source recording uses
`docs/development-tasks/race-settlement-receipt-authority.json`: compiled Node 22
backend/operator safeguards, full race coverage, types/lint, client recovery,
seven isolated artifacts and dependency audits, security, scalability, source-size
and TSDoc checks. Its local dashboard receipt establishes this finite change; the
comprehensive reliability goal remains active.
