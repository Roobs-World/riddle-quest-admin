# React visual parity acceptance pack

This directory records the visual acceptance evidence for the standard React
conversion of Riddle Quest. The immutable implementation reference is Git commit
`2adbaa0a2f3aeb856443baa97d656d9ff338a264`; the curated Android screenshots are
in `../reference-screenshots/android/`.

## Capture conditions

- Browser viewport: 540 × 1170 CSS pixels.
- Runtime: Vite React build with the deterministic Jest SDK harness.
- State: storage is cleared before each scripted run.
- Visual source: the original Poppins/Poetsen typography, colors, spacing,
  artwork, solar-system configuration, modal treatment, and interaction order.
- Browser output: no application console errors.

Run the acceptance pack with:

```bash
bash scripts/capture-visual-parity.sh
bash scripts/capture-outcome-parity.sh
```

## Current React matrix

The `current/` directory contains:

1. onboarding
2. instructions
3. guest registration notice
4. game tooltip tour
5. normal game
6. settings
7. profile tooltip tour
8. profile
9. achievements
10. statistics
11. ranks
12. leaderboard
13. treasure reward
14. help
15. credits
16. about/legal
17. coin shop
18. game-mode selection
19. hint confirmation
20. skip confirmation
21. username editing
22. victory
23. paid continuation offer
24. purchased extra guess
25. final loss

## Intentional Jest substitutions

The React conversion preserves the game's presentation and rules except where
the Jest HTML5 platform replaces a native capability:

- Jest player identity and registration replace Firebase/social sign-in pages.
- Jest payments replace native in-app purchases.
- Jest referrals, notifications, social profile, screenshots, preferences, and
  lifecycle signals replace their native equivalents.
- Rewarded ads and ad controls are removed.
- Loss continuation grants exactly one additional guess for 100 coins.
- Haptics are omitted because the Jest HTML5 SDK has no haptics capability.
- Android status/navigation chrome is represented by the browser viewport and
  safe-area layout rather than copied into the game UI.

The archived `after-loss-modal-open.png` includes a development modal-toggle
panel. It is not a player feature and is deliberately absent from the React
capture.
