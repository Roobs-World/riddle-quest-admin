# Tracking And KPIs

Last updated: 2026-05-23

## Link Taxonomy

Use consistent campaign parameters on every public link.

| Parameter | Example | Notes |
| --- | --- | --- |
| source | tiktok, apple_search_ads, creator_handle | Where traffic came from |
| medium | organic, paid, creator, pr, community | Channel type |
| campaign | prelaunch, beta, seven_day_challenge | Campaign name |
| content | riddle_hook_01, screenshot_test_a | Creative or post identifier |
| language | en, es, pt, fr, de, ja, ko, zh, hi, ru, tr | Language intent |

Example:

`https://riddlequest.example/?utm_source=tiktok&utm_medium=organic&utm_campaign=prelaunch&utm_content=riddle_hook_01&utm_language=en`

## Store And Campaign Metrics

Track weekly:

- Store product page views.
- Store conversion rate.
- Installs by source, campaign, content, and language.
- Cost per install.
- Cost per retained user.
- Ratings count and average rating.
- Review themes.
- Creator post views, clicks, installs, and retained installs.
- Email or pre-registration signups.

## Product Events To Track

Use exact, stable event names where possible.

| Event | Trigger |
| --- | --- |
| `first_session_started` | First app open after install |
| `tutorial_started` | User starts tutorial |
| `tutorial_skipped` | User skips tutorial |
| `first_riddle_started` | First playable riddle loads |
| `guess_submitted` | User submits a guess |
| `first_riddle_solved` | User solves first riddle |
| `first_riddle_failed` | User fails first riddle |
| `hint_used` | User spends coins or reward for hint |
| `daily_challenge_started` | Daily challenge begins |
| `daily_challenge_completed` | Daily challenge ends |
| `classic_level_completed` | Classic level ends in win |
| `achievement_unlocked` | Achievement fanfare appears |
| `leaderboard_opened` | User opens leaderboard |
| `share_tapped` | User taps share |
| `rewarded_ad_started` | Rewarded ad begins |
| `rewarded_ad_completed` | Rewarded ad grants reward |
| `shop_opened` | Coin shop opens |
| `purchase_started` | IAP flow begins |
| `purchase_completed` | IAP validation succeeds |
| `review_prompt_shown` | Rating prompt appears |

## Acceptance Criteria

Pre-launch:

- 500-2,000 emails or pre-registrations.
- 100-300 beta testers.
- At least 20 usable creator/social videos.

Launch:

- Store conversion rate improves week over week through listing tests.
- Day 1 retention reaches 35% or higher.
- Day 7 retention reaches 12% or higher.
- Average rating is 4.4 or higher after the first 100 reviews.
- At least one paid or creator channel shows promising retained-user cost.

## Weekly Report Template

Week:

Topline:

- Installs:
- Pre-registrations/waitlist:
- D1 retention:
- D7 retention:
- Store conversion:
- Average rating:
- Spend:
- CPI:
- Best channel:
- Best creative:
- Worst channel:
- Action for next week:

