# Multiplayer browser failure repair — 2026-10-02

The Facebook and Reddit walkthroughs still expected `.race-hub-tabs` and the recorded race Activity/Tournaments screens. The current `RaceTo10Game` opens the live PvP category intro. The original browser runs reproduced those selector failures; no production multiplayer change was needed to repair them.

Both walkthroughs now use a shared injected live transport fixture through their actual target adapters. They verify category selection, authenticated join failure and retry with the same payload/request ID, recovery from a failed progress poll without another join, rival identity and a five-second countdown, layout at 390px and 1280px, explicit leave commands, a fresh request ID for a subsequent search, and return to solo play. Provider diagnostics stay out of the rendered error. Reddit live requests remain same-origin under `/api/*`.

Reddit also dismisses onboarding through its visible controls before entering multiplayer, replacing the previous programmatic click beneath the guidance overlay. Facebook retains its authentication, lifecycle, notification, result-sharing and rewarded-continue checks. Recorded hub assertions were removed from these normal-entry walkthroughs because those screens are no longer exposed by that entry; the retained recorded race and provider adapter unit suites still run.

The callable-list and Classic buffer fixture failures reported during the economy work already passed in the starting checkout. Their fixes were present from concurrent work and were not rewritten here.

Passing final verification:

- Combined injected Facebook and Reddit browser walkthroughs: 2 suites / 2 tests.
- Full portal unit run: 256 suites / 2,101 tests, with 15 optional browser suites skipped in that run.
- Full backend unit run: 126 suites / 1,530 tests, including the formerly failing Classic buffer fixture.
- All six production target builds and isolation audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo.
- Reddit Devvit package built from the isolated client artifact.
- Portal type check, file-size audit and whitespace check.

The repository-wide TSDoc check still reports declarations in other concurrent work; none are in this repair's files. An initial broad backend run encountered a concurrently edited deployment-options assertion; the final full rerun passes after that file changed in the shared checkout.

Logs: `artifacts/multiplayer-failure-repair/`. These browser fixtures inject authority responses and exercise the shipped UI/transport boundaries; they do not contact production services or prove real-provider matchmaking. No deployment was performed.
