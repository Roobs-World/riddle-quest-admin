# Referral completion attribution verification

The local backend repair binds a newly created Facebook or Reddit referral settlement to the exact opaque solo completion receipt that earned it. Only a matching receipt includes that bonus in its returned reward breakdown. Wallet grant keys, grant amounts, caps and race delivery remain unchanged. This repair has not been deployed. Jest identities cannot enter either provider referral path.

Before repair, four focused regression cases failed: both providers overstated a later 35-coin win as 135 and its balance as 560 instead of 460; both attached a historical unbound referral to a new 25-coin win, reporting 125 and 525 instead of 425. The reproduction intentionally selected only those four cases; its other pending cases were not executed in that run.

After repair, all eight affected unit suites passed 136 tests, and all seven affected private Firestore emulator suites passed 137 tests. The final combined result is 15 suites and 273 tests passing, with zero failures or skips. This is targeted verification, not a repeated full-project run.

Coverage includes the earning receipt and its retries, later receipt exclusion, legacy/multiplayer settlements without attribution, malformed input and stored attribution, inviter deletion, preservation of only a validated opaque receipt hash, concurrent wallet grants/caps, referral retention, Facebook/Reddit race delivery, real solo completion transactions, and callable/repair behavior.

Legacy rows are never backfilled or assigned to whichever completion happens to replay first. Their wallet rewards remain credited, but the backend cannot safely reconstruct which historical solo receipt earned their referral detail. New settlements keep their attribution through identity-erasing tombstones so the surviving invitee can replay the earning receipt without duplicating grants.

Direct backend TypeScript compilation, direct backend lint, the repository TSDoc audit and owned-file whitespace checks passed. After tests, only an explicit unknown type annotation was added to the already validated stored attribution values; direct compilation and lint were repeated successfully.

All integration data used private loopback Firestore port 19799 and demo projects. The emulator exited successfully and stopped. Its legacy race-settlement fixture uses a second demo project, producing a single-project-mode warning without accessing production. Integration logs retain test progress/verdicts and exclude CLI debug environment output.

A separate read-only review found no actionable regression in the frontend receipt parser, current-completion admission, replacement/reset behavior, persisted recovery validation or acknowledged-win rendering. Historical receipt balances do not replace the authoritative wallet. No frontend tests were repeated by this reviewer.
