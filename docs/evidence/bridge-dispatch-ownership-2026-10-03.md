# Bridge dispatch ownership, warm validation, and account notices — 3 October 2026

The listeners previously retired error replies, but their routers could still enter successful handlers after an asynchronous validation-chunk load. A paid command queued by an old account could start after account retirement, and a host result could mutate a closed or replaced game listener. Loaded parsers still incurred an unnecessary resolved-promise await for every subsequent message. Host notices were global React state, so an already-rendered notice and old dismiss callbacks could affect a replacement account.

## Reproduction and implementation

The new unit tests call the actual routers with schema-valid messages. An account or listener retires while a cold router yields for parser loading. Both directions originally invoked their retired handlers. A warm command also failed to enter its handler before the caller resumed. The three recorded baseline tests fail for these behaviors; successful current dispatch and invalid-envelope rejection remain covered after the fix.

The browser fixture mounts the real host and game listeners, real authentication and game-router hooks, and both router factories. It holds the actual lazy validation JavaScript response using browser request interception. It then changes account, generation, provider, or listener lifetime before releasing those bytes. Authority handlers are controlled fixture adapters; these tests do not spend real coins or write production state. Concurrent valid commands share one actual parser download.

Four original runtime modules are preserved as `*.before.txt` under `artifacts/bridge-dispatch-ownership-2026-10-03/`. The notice baseline is explicitly a faithful extraction of the original `PlayHostApp` global `useState` pattern, since the new notice module did not previously exist. `baseline-hashes.json` identifies all baseline sources. The complete baseline fixture records 38 mismatches among 84 desktop/phone observations.

Both routers now accept the originating listener's ownership guard and check it immediately before handler entry, after validation. Host dispatch retains both the exact account visit and listener lifetime; game dispatch retains the listener lifetime. Retired messages may still produce a validated envelope as the router's return value, but cannot invoke a handler. That envelope is not an authority receipt or grant. The existing handlers remain responsible for operations that have already begun.

Successfully loaded parser functions are retained separately from the shared loading promise. Warm messages validate and enter their handlers synchronously, removing the previous resolved-promise await. Cold loads remain lazy and coalesced. Profile and leaderboard presentation have their own additional asynchronous schema work, so those paths recheck ownership again before reducer dispatch.

`useHostNotice` stores each transient notice with the existing authentication visit identity. A new visit immediately renders its target configuration warning or no notice, without showing the previous player's text. Old setters and queued state updates cannot overwrite or dismiss the new player's notice. The subscription guard also rejects old notice writes before replacement state renders. Profile-only updates preserve the current notice and stable setter. `PlayHostApp` uses this module, and its dismissal timer and command dependencies include the current setter.

No visible product copy, provider SDK, economy grant, or target boundary was added. Required documentation comments were added to six declarations in concurrent leaderboard work without changing that work's behavior.

## Verification

Evidence is in `artifacts/bridge-dispatch-ownership-2026-10-03/`:

- All 84 browser observations pass with development StrictMode and another 84 with production React at 1280 and 390 pixels. They cover real delayed validation bytes; account, generation, leave/return, provider, sign-out, and unmount retirement; same-owner profile updates; one shared chunk load; immediate warm dispatch in both directions; retired game callbacks; post-handler asynchronous profile/leaderboard validation; visible notice ownership; old dismiss and write callbacks; pre-render notice retirement; provider replacement; and persistent target configuration warnings. No uncaught browser errors occur.
- New router ownership tests and additional game-router presentation tests pass. The full portal suite passes 279 suites and 2,411 tests; 118 opt-in tests are skipped. Counts include concurrent changes from other chats.
- The existing host lifecycle regression fixture passes all 232 observations across both React runtimes. Single-player recovery passes at desktop and phone widths, including replay, startup/completion reconnect, profile delivery, account retirement, editing, and unmount.
- Complete hosted production Jest, Facebook SDK, and Reddit Devvit browser journeys pass. They exercise actual target entries with injected authority/provider APIs, including startup, authentication, solo and multiplayer flows, responsive layouts, purchase/reward delivery, restoration, and provider lifecycle. The Facebook journey builds its own isolated 13+ fixture. Saved hosted gameplay screenshots were inspected.
- All workspace types and all six production target builds and artifact-isolation audits pass. `build-results.json` records exits/durations. Final hashes confirm that all tested runtime modules, production caller, new fixture, and owned unit-test sources match the recorded tested sources.
- Final TSDoc audit passes for 24,078 declarations across 1,097 files. Source-size audit passes for 1,171 files. Script syntax, command registration, and scoped whitespace checks pass. The normal game-browser command includes both runtimes of the new fixture.

The proven scheduling improvement is immediate handler entry once parsers are loaded. Logs retain controlled input-feedback observations; they are not production network measurements or a measured frame-rate improvement. Browser verification used Chromium. Aggregate checks describe the shared checkout. No commit or deployment was performed.

The goal remains active. Next, test a failed lazy validation-chunk load: the cached import promise can remain rejected, and recovery must be verified against actual browser module-loading behavior before choosing a retry or reload strategy.
