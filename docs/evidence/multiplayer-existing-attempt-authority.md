# Existing challenge attempt recovery authority

The accepted-run recovery pointer identified a requested run, but a schema-valid resume response with that ID could still carry another challenge, a creator role or another category. Three baseline regressions reproduced those acceptances. The existing run-ID guard and independent creator cold-resume control already passed.

Cold recovery from a ready challenge entry now checks the accepted run ID, selected challenge ID, challenger role and entry category before adopting the run. The check is limited to an existing-attempt entry pointer; independent creator resumes retain their existing behavior. Rejected responses use the translated invalid-response error and cannot dispatch race readiness.

The full client suite passes 1,699 tests across 197 suites, with 102 tests and 13 suites skipped. Ten injected-browser cases exercise the actual direct-link entry-to-resume bridge flow at desktop/mobile widths: wrong challenge, role, category, run ID and a valid pointer. Invalid cases show the existing error and issue neither readiness nor another start; valid recovery proceeds to readiness without creating another attempt.

Sixty retained browser cases pass across startup recovery, rendered entry replacement and private command ownership. All seven isolated target builds, exact dependency evidence, portal types, security and scalability pass. A recheck finds no change in the 333 backend files captured by the preceding passing 1,068-test coverage run; this is a captured-file recheck, not whole-source completion.

Logs and hashes are held in `artifacts/race-existing-attempt-authority/verification-held.json`. The manifest retains previous checks and adds this direct-link browser gate, for 67 checks. Global TSDoc and hosted E2E size failures remain in concurrent files outside this focused change. No hosted Jest update, publication or Firebase deployment occurred in this batch; dashboard recording and the broader reliability audit remain pending.
