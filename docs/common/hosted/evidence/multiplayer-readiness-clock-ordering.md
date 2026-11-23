# Multiplayer readiness clock ordering

30 September 2026 local development evidence for named HTML5 platform artifacts.
No visible text, translations, provider integrations or production data changed.

## Reproduced lifecycle failures

All twelve initial public-interface demo-emulator cases failed before correction,
in both legacy and versioned storage: older readiness/resume requests rewound an
accepted countdown; cancellation during countdown failed canonical validation;
blocked recovery recorded an abandonment before readiness; and older recovery
preceded an accepted preparation-expiry timestamp. The cancellation failure arose
because an accepted pre-start cancellation marker was treated as an impossible
negative scored duration, even though the engine explicitly supports this action.

## Accepted clocks and bounded cancellation

Readiness now retains its first accepted clock on the owned server run, separate
from its future scored start. Storage validates their fixed lead-in relationship,
preparation deadline and ordering against later actions/terminal clocks. The engine
uses readiness and abandonment timestamps as additional accepted-progress floors.
Historical scheduled storage without the new marker uses the existing fixed
countdown lead-in. An already-active phase cannot be projected before scored start.
Public projections do not expose the new server-only readiness field.

An untouched abandoned countdown may have its accepted cancellation before scored
start, with zero duration, score, question progress, guesses, hints, penalties and
events, and its finished timestamp equal to its accepted action. This narrow
storage exception does not permit pre-start gameplay, charged progress or damaged
readiness chronology. Exact cancellation retry returns the accepted receipt;
subsequent recovery remains abandoned and creates no economy or creator delivery.

## Verification

The new emulator suite covers eighteen cases across both record versions,
including older readiness/resume, legacy scheduled-marker absence, pre-start
scoring rejection, two cancellation clocks, exact retry, blocked recovery,
preparation expiry and accepted active phase. Eleven parser cases exercise valid
new/legacy cancellation and inconsistent readiness/pre-start scoring rejection.
The initial expanded focused run passed 149 checks; the subsequent active-phase
floor and its two cases are included in the complete verification.

The first complete race run passed 944 cases but failed the existing future-terminal
reward-safety test. Initially flooring every finished timestamp incorrectly allowed
an unaccepted future competitive finish to bypass settlement rejection and grant
rewards. That change was corrected to floor abandonment timestamps only; accepted
competitive progress still uses actual action/event/settlement/grant evidence. The
existing reward-safety test and its unchanged-state assertions were preserved.

Backend types and lint passed. An early TSDoc audit observed 23 undocumented locals
and fields in concurrently edited matchmaking batching tests/code. Only explanatory
comments were supplied there; its behavior remains owned by that independent work.
The TSDoc audit then passed. A subsequent complete run passed through the platform
builds and audits before six new documentation failures appeared in concurrent
read-only discovery changes. Only the missing explanatory comments were added;
no concurrent retrieval behavior was changed by this task. Full stable-source recording uses
`docs/common/development/development-tasks/race-readiness-clock-ordering.json`: Node 22 backend and
operator safeguards, full race coverage, types/lint, client recovery, seven isolated
artifacts and dependency evidence, security, scalability, size and TSDoc checks.
Only a successful receipt updates the local completion dashboard. The broader
multiplayer reliability goal remains active; no production deployment is implied.

## Jest draft-only release instruction

The user explicitly withheld live Jest builds and requested drafts. The canonical
timestamped release now fixes activation intent to false, retaining every existing
immutable-byte, clean-source, credential and upload barrier. The root and combined
release plans disclose an inactive draft effect. Persistent/ambient activation
variables remain rejected. Existing explicit inactive flags remain compatible.
Current operations, credential and quickstart instructions and the workflow name
now describe draft upload. Historical deployment evidence remains intact.

All thirty focused release-contract checks passed, and the read-only release plan
reports the draft effect and separate activation hold. No upload, activation,
workflow dispatch, commit, push or deployment was performed by this work. The
complete recording adds this release-contract gate alongside the eleven existing
multiplayer/build/audit checks. Shared source changes during prior complete runs
withheld completion receipts; only a source-stable successful run may record this
combined implementation on the local dashboard.
