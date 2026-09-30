# Projection health and matchmaking recovery

Development evidence for the local working tree, 30 September 2026. No production maintenance setting, policy, data, deployment, index or alert was changed.

## Behaviour and ownership

- Reconciliation retains current-cycle unavailable observations through both canonical and candidate passes, plus the most recent complete cycle's unavailable observations. A later healthy page does not erase earlier corruption. Only the current lease holder advances these facts.
- A complete-cycle clock requires a trustworthy canonical-pass start. Legacy candidate-only checkpoints remain unobserved until both passes have run; a committed page alone does not establish a complete cycle.
- Independent recovery health reads maintenance configuration and the checkpoint alongside deadlines, original retry ages and both outboxes' pending/quarantine facts. The maximum observation is 153 documents. Ages/counts are allowlisted; no cursor, lease identity, source payload or answers leave the checkpoint.
- Enabled page progress warns after ten minutes without trustworthy completion. Complete-cycle delay has a separate one-hour diagnostic threshold. Missing/invalid/future clocks stay unknown. Disabled maintenance is not called stalled, while retained failures/unavailable observations remain visible.
- Corrupt exhausted discovery returns typed `projection-unavailable`, same-intent recovery and a 15-second delay. Empty eligible pools retain empty/new-search behaviour; bounded caps retain new-intent recovery. All existing authorization and acceptance checks remain authoritative.
- Start-command telemetry records returned/failed invocations outside transaction callbacks, including failed offered entry before an accepted run exists. Logs contain no account, offer, challenge, run or request IDs, answers or error payloads. Duplicate requests are separate command observations; durable offer clocks remain conversion authority.

## Verification

Core race coverage passed 145 tests across 19 suites with 100% coverage. Portal race coverage passed 1,052 tests across 135 suites with 96.52% lines; 92 browser-only tests were explicitly skipped in that unit gate. The separately executed injected Reddit browser suite passed its rendered same-origin journey, including delayed Retry, same-request reuse, capped-search rotation and navigation after successful selection. All six target builds and isolation audits passed; the additional GameSnacks build passed.

Backend emulator regressions cover retained unavailable observations across healthy pages, clean-cycle replacement, legacy partial checkpoints, invalid/missing/future health clocks, unchanged source checkpoints, private-payload exclusion, corrupt-projection typed recovery and start-command success/replay/failure observations. The final Node 22 backend gate passed 579 tests across 44 suites with 96.79% lines, 94.53% statements, 88.26% branches and 97.25% functions. Ten command safeguards and the 152-module production cycle audit also passed.

Scoped backend lint, documentation audit (718 declarations across eleven selected production, backend and core test files), security configuration/CI security, scalability and whitespace checks passed. This scoped documentation audit does not establish repository-wide documentation completion.

See [operational correlations and metric limitations](../race-match-operations.md). Global checkpoint ages are reconciliation progress measurements, not publication latency or pool-specific causal evidence. Counts are observations rather than a deduplicated source population. Command failures and returned retries cannot substitute for unique-offer acceptance rates.

Cross-record integrity, session ownership verification and the original whole-architecture requirement audit remain open.
