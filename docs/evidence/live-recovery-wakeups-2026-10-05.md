# Live multiplayer recovery wakeups — 5 October 2026

Reconnect, foreground and countdown-start signals now survive an owned delivery. They reuse the existing refresh queue, so a held response is followed by one current read. A successful player command is not replayed. Queued reads retry when outage backoff expires, including a signal arriving after the failed read has already armed the healthy push watchdog.

The original real React component fixture failed 2 of 5 assertions: reconnect during a held poll admitted no catch-up and left rival progress at zero. The final matching baseline failed 19 of 89 assertions. Development and production passed 267 assertions each across 14 scenarios and three viewports. Existing scheduling, retirement and countdown checks added 1,296 passing assertions, for 1,830 total. Repeated wakeups coalesced; hidden-only transitions, retirement and account replacement retained their boundaries.

Firefox verified four cases against the injected transport and actual component DOM. Reconnect admitted its next read 1 ms after release; foreground recovery kept one accepted native `piano` submission; countdown release promptly exposed the first prompt; a failed catch-up retried 2,000 ms after rejection. No browser errors or unhandled rejections occurred. These are client fixture measurements, not provider or internet latency certification. An initial exploratory Firefox read expired while separate UI operations were being issued; its record is retained separately and excluded from the four verified cases.

Validation passed: 2,855 unit tests in 300 suites, types, 25,523 documented declarations across 1,144 files, all six isolated target audits, and eight built-artifact browser tests in three suites. The buffered transition budget stayed at 100 ms. YouTube was an incomplete-content fixture build, not release certification. No product text, provider SDK, scoring, reward or purchase contract changed.

The checks used 1,517 stable source inputs. All 1,300 built files and six target metadata records were preserved before removing the owned temporary build root and metadata. All owned jobs ended; the Firefox server and owned tabs were closed. The goal remains active. A subsequent unavailable-invitation timer audit is tracked separately.

- [Machine-checked summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-recovery-wakeups-2026-10-05/verification-summary.json)
- [Owned change](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-recovery-wakeups-2026-10-05/own.diff)
- [Firefox records](/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-recovery-wakeups-2026-10-05/firefox-native.json)
