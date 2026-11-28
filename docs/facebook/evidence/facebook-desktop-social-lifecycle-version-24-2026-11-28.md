# Version 24 desktop social cancellation and focus checks — 28 November 2026

**Native Profile Invite and result Share cancelled without sending, and their game controls recovered.** The attempted visibility check established focus loss only. This single-account Chrome sequence used the unchanged **Testing version 24 / bundle 29078291508509160 / SDK 8.0 WEB**, without a phone. The [structured record](facebook-desktop-social-lifecycle-version-24-2026-11-28.json) retains private receipt and screenshot hashes; account/profile images are not published.

The initial launch still showed **Loading 5%** at **10:07:35.494** and **10:08:29.049 UTC**. Those were not ready-game observations. One ordinary reload preceded ready gameplay at **10:09:16.527**, restoring TIGER and **1,585 coins** without notices. The loading issue’s cause is unknown; this does not establish a startup repair.

| Check | Observed outcome |
|---|---|
| Profile Invite | The native invite card opened. Closing it without selecting a recipient or sending restored the enabled, non-busy Invite a friend button at **10:10:00.920**, with 1,585 coins and no notices. |
| Result Share | An ordinary TIGER win awarded +25 coins, reaching **1,610**. Share opened the native **Share game destination chooser**. Closing it without choosing a destination restored enabled Next Level/Share controls at **10:10:40.170**; the balance remained 1,610. No post or message was sent. |
| Focus and input | Next Level displayed PEACOCK. Selecting an owned blank tab left the game `visible`, `document.hidden=false`, unfocused and without a paused root class at **10:11:04.960**. Returning focus and typing A worked. This did **not** establish hidden→visible recovery. |

Initial onscreen Backspace and selected-cell delete attempts left A in place. Read-only hit tests at **10:13:45.562–10:13:53.999** found a DIV above the board/key centers under Meta’s `igdebug_css_boundary` panel. After closing that panel, ordinary **physical Backspace** cleared all seven current-row cells by **10:14:24.168**; the balance remained 1,610. The onscreen Backspace center still hit a DIV whose ancestor was not inspected. Its identity, the panel’s opening cause and onscreen-button recovery are unproven. No IGDebug console or SDK tools were selected, and no game-code fix was made. Earlier receipts with “cleared” or “hidden” in their filenames retain their actual uncleared/visible observations.

Normal game Quit reached `/gaming/play/` at **10:15:00.304**, with **one total iframe** recorded. The owned game and blank tabs were closed and preexisting tabs preserved. No relaunch followed this Quit, so no new persistence claim is made here. Sound remained On and Reduced Motion Off.

These are cancellation and focus/input observations, not social delivery, hidden/resume acceptance or full submission acceptance. The startup cause and separate Android issue remain unresolved. No source, Firebase/provider-server code or configuration, build, deployment, upload, Meta configuration, Vercel change, Production promotion, publication or review submission occurred. Earlier evidence and **51 W / 10 C / 6 G / 12 X** source classifications remain unchanged.
