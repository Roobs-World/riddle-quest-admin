# Game design refresh — 3 October 2026

The game retains its space theme and playful typography with a quieter navy background, cream clue cards, gold focus states, opaque letter cells, defined keyboard keys, and consistent dark controls. Tall desktop screens now use a centered puzzle stack; short landscape screens retain two columns. Daily actions fill both columns, and narrow Classic navigation and landscape keyboard rows stay within the viewport.

YouTube, Netflix, and Yahoo share the same palette and circular answer cells. Empty answer buttons now have localized screen-reader names using existing translations, and the attempts container has a valid group role. No translation keys were added or removed.

## Preview

- `game-jest-classic-390x844.png`: Classic on a phone.
- `game-jest-1440x900.png`: centered desktop layout.
- `game-jest-844x390.png`: compact landscape layout.
- `onboarding-jest.png`: welcome screen.
- `feedback-jest.png` and `high-contrast-jest.png`: letter feedback and high contrast.
- `game-netflix-390x844.png` and `menu-netflix.png`: self-contained playable screens.

## Verification

- All six production builds and artifact boundary audits pass: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo. See `build-*.log`.
- The injected browser harness run passes 16 of 17 tests across seven suites. Facebook, Reddit, YouTube, both standalone candidates, short-phone viewport fitting, and instructions scrolling pass. See `browser-final.log`.
- The broader Jest journey stops at `hostedBrowser.jest-playwright.test.ts:362`: opening multiplayer leaves the seeded `riddleQuest:activeRaceRun` value `expired-run-from-previous-session` in local storage instead of clearing it. This assertion is outside the styling and playable ARIA changes; later assertions in that journey were not reached.
- The first Reddit run timed out on its host-locale marker; the final run passes.
- Additional screenshots and WCAG 2.2 AA audits cover Classic and Daily at 390×844, 320×568, 844×390, and 1440×900. Game surfaces and individual keyboard keys remain within the viewport. Feedback, high contrast, and settings are also audited. No page errors or accessibility violations were found. See `visual-inspection*.log` and `landscape-final.log`.
- Netflix and Yahoo screenshots and accessibility audits cover those same four viewport sizes with no page errors or accessibility violations. The existing playable harness verifies YouTube lifecycle/save behavior and candidate gameplay without outbound provider traffic.
- Changed-file whitespace validation passes.

Reproduce the supplementary screenshots from the repository root using `node artifacts/design-refresh-2026-10-03/inspect-design.mjs`, adding `jest classic`, `netflix`, or `yahoo` as appropriate. This serves the local built artifacts and injects the trusted mock marker for Jest.
