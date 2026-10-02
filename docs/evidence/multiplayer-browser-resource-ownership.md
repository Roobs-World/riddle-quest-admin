# Multiplayer browser resource ownership

A new injected-browser gate observes actual native resources installed by `useRaceSession`, independently of the session's active/disposed flags. It wraps browser interval registration and bridge/visibility listener registration while preserving the real native calls and callback identities.

Eight runtime/viewport cases pass: production/development React, normal/StrictMode wrappers, and desktop/mobile. Each performs three account/locale entry replacements followed by child unmount/remount, for twenty-four cycles. Mounted surfaces retain exactly one 50ms interval, one host-to-game listener and one document visibility listener. Entry replacement exchanges its bridge listener while preserving the existing scheduling interval. Development StrictMode verifies two native resource setups per mount and one retained live resource of each kind.

Child and root unmount leave no tracked resource. The gate waits longer than two interval periods and confirms the actual callback count stops. Dispatching bridge and visibility events after unmount cannot issue a command. Remount repeats the expected setup count and retains exactly one resource of each kind.

Independent negative controls remove interval cancellation, bridge removal or visibility removal only from the injected test bundle. Each control fails all eight cases, demonstrating that the gate detects each resource leak separately. A combined leak control also fails. Negative results are retained and are not accepted as passing verification. Production files are untouched; their hash still matches the preceding focused verification.

Logs and hashes are in `artifacts/race-session-browser-resources/verification-held.json`. The new manifest retains previous gates and adds browser resource ownership, for fifty-six checks. This verifier-only batch does not claim a fresh full client/build run or verify every timeout in provider/transport modules. Full-source dashboard recording remains pending while the user-owned E2E chat finishes. No hosted Jest update/publication or Firebase deployment occurred. The broader reliability audit remains active.
