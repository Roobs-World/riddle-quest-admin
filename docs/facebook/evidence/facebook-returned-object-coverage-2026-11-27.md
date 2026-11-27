# Tournament and LiveMatch returned-object coverage — 27 November 2026

A read-only source audit at `70cc0d0c7eb3f15edd7aecd9e1ae9df50363bc33` checked the SDK declaration inventory against real consumers and UI routes. All six declared Tournament getters and both LiveMatch getters have meaningful reachable uses. No source-only addition is warranted for these methods.

| Returned methods | Reachable use |
| --- | --- |
| Tournament `getID`, `getEndTime`, `getTitle` | [FacebookNativeSocial](../../../platforms/web/facebook/src/social/FacebookNativeSocial.ts) validates identifiers and expiry, deduplicates/orders active listings, and sanitizes titles for display. |
| Tournament `getPayload`, `getTournamentType`, `getContextID` | The same adapter rereads a joined tournament and validates payload, public type, selected ID, resulting context and expiry before routing to the official locale board. |
| Private Tournament getters | [facebookPrivateTournament](../../../platforms/web/facebook/src/engagement/facebookPrivateTournament.ts) validates private type, matching points payload, locale, IDs and expiration before admitting compatible private scoring. |
| LiveMatch `getID`, `getContextID` | [FacebookNativeSocial](../../../platforms/web/facebook/src/social/FacebookNativeSocial.ts) validates both during discovery, then rereads and compares both before switching context. |

[FacebookNativeSocialPanel](../../../platforms/web/facebook/src/social/FacebookNativeSocialPanel.tsx) exposes eligible Room and tournament joins. [FacebookRaceEntry](../../../platforms/web/facebook/src/FacebookRaceEntry.tsx) routes validated tournament joins to the matching official board.

This establishes source reachability, not accepted native joins. A real eligible Messenger Room, populated eligible tournament, consenting test participants and private-tournament allowlist/group/scoring prerequisites remain necessary. Empty listings do not prove these success paths. No files, services, accounts or provider settings were changed by the audit, and no build or tests were run for it.
