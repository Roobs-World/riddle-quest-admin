# Multiplayer publication recovery

30 September 2026; working-source changes based on revision `c34be571`.

Race Session retains a rejected or malformed publication confirmation's original
run-bound receipt. Retry republishes that same mutation, allowing authority to
return its cached challenge when the original publication already succeeded.
The completed result remains visible throughout recovery. Duplicate confirmations
emit no additional sharing effect; rematch, navigation and disposal invalidate
recovery ownership. Outcome failures continue to retry the outcome read.

Publication validation checks the completed creator run, challenge/preview ID
agreement, category, locale and recorded adjusted finish time before the challenge
can reach the provider sharing adapter. No locale strings or provider contracts
change. Existing server receipt idempotency remains authoritative.

Public-session tests cover publication retry, duplicate effects, mismatched metadata
and lifetime invalidation. The injected browser test loses or corrupts the first
confirmation after the authority has persisted a challenge, then asserts one
stored challenge, identical retry receipts and one provider share with its original
challenge ID. Companion regressions cover deferred completion/publication and
lost hint/skip recovery.

Reproduce verification and record progress in the existing local dashboard:

```sh
pnpm development:complete docs/development-tasks/race-publication-recovery.json
```

The recorder requires a stable source snapshot throughout all checks before it
issues a completion receipt. Remote publication requires accepted-revision CI.
