# Locale midnight for server-backed Daily riddles

Status: accepted

Each supported language locale owns one shared IANA timezone. This is a regional content clock, not the player's device timezone or inferred location. The configured defaults are:

| Locale | Timezone |
| --- | --- |
| en | Europe/London |
| es | Europe/Madrid |
| pt | Europe/Lisbon |
| fr | Europe/Paris |
| de | Europe/Berlin |
| ja | Asia/Tokyo |
| ko | Asia/Seoul |
| zh | Asia/Shanghai |
| hi | Asia/Kolkata |
| ru | Europe/Moscow |
| tr | Europe/Istanbul |
| ar | Asia/Riyadh |
| id | Asia/Jakarta |
| it | Europe/Rome |
| nl | Europe/Amsterdam |
| pl | Europe/Warsaw |
| vi | Asia/Ho_Chi_Minh |

A single scheduler dispatches every UTC half-hour and selects only locales in their first three local hours. Every configured clock reaches midnight on one of these dispatches, including India's half-hour offset and European daylight-saving changes. The scheduled instant, rather than delayed handler execution time, determines the generation slot. Generation starts at local midnight; five subsequent half-hour slots repair missing content. Playable dated documents are reused. Model generation is not instantaneous, so availability follows successful content generation.

Daily loading, server-owned session eligibility, completion, streaks, rollover grace and the browser's preload cache use the same clock. Session validation and pending-terminal recovery use the immutable session locale rather than a newly chosen language. Recovering the previous date performs one bounded binding lookup; only the saved session’s authority can accept its terminal and grace window. Calendar-day arithmetic handles 23- and 25-hour days. Completion and receipt keys remain player-scoped calendar dates without a locale suffix: changing language does not create a second reward entitlement for the same date. A later completed calendar date prevents replay of earlier dates.

The self-contained YouTube/Netflix/Yahoo/GameSnacks content and local-save policy remain governed by ADR 0002; these artifacts do not call the server generator.

Successful scheduling does not repair an invalid OpenAI credential. Deployment and clock regression tests are distinct from live generated-content and full user-pathway E2E evidence.
