# Tracking And KPIs

Last updated: 2026-11-24

The current implementation, exact event catalogue and platform collection restrictions are in [Google Analytics and action events](../observability/google-analytics.md). The product-event list below is the original marketing plan; use the implementation catalogue for actual event names.

## Link Taxonomy

Use consistent campaign parameters on every public link.

| Parameter | Example                                    | Notes                       |
| --------- | ------------------------------------------ | --------------------------- |
| source    | tiktok, jest, creator_handle               | Where traffic came from     |
| medium    | organic, paid, creator, pr, community      | Channel type                |
| campaign  | prelaunch, beta, seven_day_challenge       | Campaign name               |
| content   | riddle_hook_01, screenshot_test_a          | Creative or post identifier |
| language  | en, es, pt, fr, de, ja, ko, hi, ru, tr | Language intent             |

Example:

`https://riddlequest.example/?utm_source=tiktok&utm_medium=organic&utm_campaign=prelaunch&utm_content=riddle_hook_01&utm_language=en`

## Game Page And Campaign Metrics

Track weekly:

- Jest game page views.
- Play conversion rate.
- Sessions by source, campaign, content, and language.
- Cost per acquired player.
- Cost per retained user.
- Ratings count and average rating.
- Review themes.
- Creator post views, clicks, plays, and retained players.
- Email or pre-registration signups.

## Product Events To Track

Use exact, stable event names where possible.

| Event                       | Trigger                              |
| --------------------------- | ------------------------------------ |
| `first_session_started`     | First game session                    |
| `tutorial_started`          | User starts tutorial                 |
| `tutorial_skipped`          | User skips tutorial                  |
| `first_riddle_started`      | First playable riddle loads          |
| `guess_submitted`           | User submits a guess                 |
| `first_riddle_solved`       | User solves first riddle             |
| `first_riddle_failed`       | User fails first riddle              |
| `hint_used`                 | User spends coins or reward for hint |
| `daily_challenge_started`   | Daily challenge begins               |
| `daily_challenge_completed` | Daily challenge ends                 |
| `classic_level_completed`   | Classic level ends in win            |
| `achievement_unlocked`      | Achievement fanfare appears          |
| `leaderboard_opened`        | User opens leaderboard               |
| `share_tapped`              | User taps share                      |
| `shop_opened`               | Coin shop opens                      |
| `purchase_started`          | Jest purchase flow begins            |
| `purchase_completed`        | Jest purchase grant succeeds         |

## Acceptance Criteria

Pre-launch:

- 500-2,000 emails or pre-registrations.
- 100-300 beta testers.
- At least 20 usable creator/social videos.

Launch:

- Play conversion rate improves week over week through page tests.
- Day 1 retention reaches 35% or higher.
- Day 7 retention reaches 12% or higher.
- At least one paid or creator channel shows promising retained-user cost.

## Weekly Report Template

Week:

Topline:

- New players:
- Pre-registrations/waitlist:
- D1 retention:
- D7 retention:
- Play conversion:
- Spend:
- Cost per player:
- Best channel:
- Best creative:
- Worst channel:
- Action for next week:
