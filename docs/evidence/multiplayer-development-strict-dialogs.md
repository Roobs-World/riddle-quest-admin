# Multiplayer development StrictMode dialog verification

The rendered dialog ownership harness now selects development React explicitly and instruments the real `useRaceSession` entry effect. Development StrictMode cases require two setups, one replay cleanup and exactly one live session. Normal development and production wrappers require one setup and one live session. Every case explicitly unmounts the React root and verifies no live session remains and cleanup count equals setup count.

All 48 development dialog cases and 48 production cases pass. Twenty-four development cases verify actual session effect replay. Existing context, native matchmaking, tournament-share and challenge-share assertions remain intact: provider replacement releases retired loading state; a late old success/rejection cannot affect the replacement dialog; unrelated provider changes retain owned guards; competitive session identity remains stable.

An initial instrumentation attempt failed before browser execution because Vite had reformatted the cleanup statement. That failure is retained and is not accepted as verification. Injection now runs before TypeScript transformation, asserting exact original setup/cleanup sites before adding counters. The production hook and component are not altered by injection.

The production multiplayer component hash still matches the preceding focused verification. This verifier-only batch does not claim a new client suite or target build run. Logs and hashes are in `artifacts/race-development-strict-dialogs/verification-held.json`. The manifest retains prior checks and adds development dialog verification, for fifty-five checks.

The shared source/dashboard receipt remains pending while the user-owned hosted E2E chat finishes. Its evidence and source remain untouched. No hosted Jest update/publication or Firebase deployment occurred. The reliability audit remains active; this gate verifies session entry cleanup and dialog ownership rather than every browser timer or provider projection under development replay.
