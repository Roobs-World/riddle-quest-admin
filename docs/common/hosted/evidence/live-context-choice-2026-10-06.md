# Native context selection preserves Activity and owns its acknowledgements

The multiplayer Activity screen now keeps the modal and global match history mounted when a native context choice succeeds. Only context standings refresh. Providers that emit immediate context invalidation already own that refresh; successful chooser acknowledgement no longer starts a second standings query. Providers without notifications retain an explicit, scoped refresh.

A pending native choice also captures its committed native provider, chooser method, context board, read method and notification operation. Replacing those operations retires both successful and failed acknowledgements. Ordinary coin/profile updates retain ownership, and an abandoned concurrent replacement cannot retire the current choice. The original native dialog lock lasts until its original operation settles. Account, locale and navigation retirement remain in place. Calls retain the original provider receiver.

## Measured reproduction

The browser harness imports the actual `FacebookContextCoordinator`, `createFacebookContextBoard`, `RaceTournamentEntry`, standings schema and history schema. Native SDK selection, membership confirmation and authority responses are injected and separately held. Browser actions enter Activity, open the native choice, replace or retain providers, navigate, and invoke a real history rematch. External traffic is rejected.

With the original selected source, three minimal cases produced 11 failures in development and production. A held membership operation admitted the event-driven read before acknowledgement: event and coordinator-fallback notification cases queried the new context twice. All three cases reread global history and replaced its row and modal. Refreshing only the context panel removed those identity/history failures but retained two duplicate-query failures. Coalescing notification and acknowledgement removed those remaining failures.

The expanded preflight then exposed two ownership failures. Retiring the original coordinator showed its eventual failure on the replacement board. A successful silent-capability acknowledgement refreshed the replacement provider twice. A minimized two-case replay reproduces both failures against the scoped-refresh source and passes against the final committed-ownership fence in both modes. The ten-case matrix additionally covers native event, SDK without event registration, capability without notifications, cancellation, unchanged context, profile changes, abandoned replacement, provider retirement and tab navigation.

## Verification

- 120 new cases, 1,836 assertions and 120 screenshots across Chromium 153 and native Firefox 153, development and production, and 390×568, 390×844 and 1280×844 viewports.
- 204 adjacent context, destination-capability and history cases with 2,928 assertions in both Chromium modes.
- Ten final minimized green cases with 128 assertions; the original-source and pre-ownership replays remain red with their expected 11 and two failures respectively.
- 2,898 portal unit tests passed; 93 explicitly skipped tests. 301 suites passed, 15 skipped.
- 23 built-artifact browser tests passed, covering Jest, Reddit and the injected Facebook fixture.
- Six isolated target builds and the Devvit server build passed. YouTube uses the fixture build; this does not certify partner release acceptance.
- Type checking, target boundaries, security configuration, file-size audit and documentation audit passed (26,602 declarations).
- 2,456 selected source inputs remained byte-identical after freeze. Four owned source records have before/after hashes and a reversible diff.
- Existing authority proof is reused only after comparing all 824 selected inputs and 24 compiled core copies. Backend/SDK integration suites were not freshly rerun for this client-only change.
- 1,301 output files and six dependency inventories were preserved and hashed before removing the exact owned temporary build root. The Facebook fixture inventory was also preserved before deleting its owned metadata. Browser jobs terminated and their scratch directories were removed.

One artifact-only reduced driver initially could not resolve Vite from the evidence directory. Its four terminal import failures are retained separately; the harness import was corrected and all four red/green diagnostic runs repeated. No frozen source changed for that correction. Firefox checks use the native Firefox executable; they do not claim Firefox MCP coverage.

Run `python3 artifacts/live-context-choice-2026-10-06/verify.py` from the repository root to verify source, runtime, authority, artifact and cleanup evidence. The full goal remains active. No deployment or commit was performed. The earlier multiplayer retirement callable/Devvit-route/TTL release dependency remains unchanged: deploy that backend contract before releasing those clients.
