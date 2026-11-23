# Countdown clock ownership

The countdown previously read scheduled start time, server time and response receipt time from the public state. A retained rendering reference could make gameplay start early, delay it indefinitely, or erase the schedule and invoke the legacy countdown path. The privately confirmed schedule and monotonic receipt anchor already existed but did not govern this transition.

Countdown calculation now uses those private facts. GO activation publishes a deep copy of the privately confirmed scheduled run with the locally advanced clock. Mutating the published deck cannot alter the authority retained through the GO interval. Compatible legacy responses continue to use the established unscheduled countdown behavior.

Five regression cases failed before the fix; the unchanged-schedule control passed. Seven focused tests now pass, including nested content isolation during GO. The full client suite passes 1,780 tests across 213 suites (102 tests across 13 suites skipped). Twelve real desktop/mobile rendered browser cases validate early/late start rewrites, server/receipt rewrites, schedule omission and unchanged controls. The safety and hint browser gates also pass. All seven configured isolated HTML5 builds and dependency audits, client types, source documentation and size limits, security and scalability pass.

The guarded manifest `docs/common/development/development-tasks/race-countdown-clock-ownership.json` retains 83 preceding checks and adds the countdown browser gate. The dashboard receipt requires all 84 checks to pass with unchanged HEAD and full source digest. Generated evidence and receipts remain in artifacts; the hosted E2E chat's evidence is untouched.

The multiplayer reliability audit remains active. Jest remains unpublished; no Functions deployment or game publication occurs in this checkpoint.
