# Locale 09:00 for server-backed Daily riddles

Status: accepted, amended 16 October 2026 to replace midnight with 09:00 and remove periodic repair polling.

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
| hi | Asia/Kolkata |
| ru | Europe/Moscow |
| tr | Europe/Istanbul |
| ar | Asia/Riyadh |
| id | Asia/Jakarta |
| it | Europe/Rome |
| nl | Europe/Amsterdam |
| pl | Europe/Warsaw |
| vi | Asia/Ho_Chi_Minh |

One scheduler dispatches the UTC slots that can contain regional 09:00 for these clocks: `0,30 0,2,3,6-9 * * *`. The handler generates only for locales at exactly 09:00, including India's half-hour offset and European daylight-saving changes. Unused dispatch slots return without reading or writing content. The scheduled instant, rather than delayed handler execution time, selects the generation date. Two scheduler retries reuse that instant and only fill missing or invalid documents. There is no periodic repair window. Playable dated documents are reused; availability follows successful generation.

The challenge day begins at local 09:00 and lasts until the following local 09:00. Before that boundary, players continue the previous dated challenge. `getDailyStart` resolves the regional wall clock directly so daylight-saving changes do not shift the reset hour. The legacy internal `UTC` clock retains its midnight behavior. Language determines the configured content clock; the game does not infer a player's continent or permit an arbitrary client timezone. These current defaults cover European and Asian regions, rather than separate schedules for every continent.

The loader accepts only a supported language, response-format flags, and a paired opaque session/riddle locator for recovery. Callers cannot supply a date, clue, answer or replacement riddle. It loads the server-selected dated document and checks its identity and language. Guess and completion authority stays bound to the immutable server-issued session.

Daily loading, server-owned session eligibility, completion, streaks, rollover grace and the browser's preload cache use the same 09:00 clock. Session validation and pending-terminal recovery use the immutable session locale rather than a newly chosen language. Recovering the previous date performs one bounded binding lookup; only the saved session’s authority can accept its terminal and grace window. Calendar-day arithmetic handles 23- and 25-hour days. Completion and receipt keys remain player-scoped calendar dates without a locale suffix: changing language does not create a second reward entitlement for the same date. A later completed calendar date prevents replay of earlier dates.

The self-contained YouTube/Netflix/Yahoo/GameSnacks content and local-save policy remain governed by ADR 0002; these artifacts do not call the server generator.

Successful scheduling does not repair an invalid OpenAI credential. Deployment and clock regression tests are distinct from live generated-content and full user-pathway E2E evidence.
