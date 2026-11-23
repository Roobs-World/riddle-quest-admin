# Matchmaking retirement on visibility recovery

The new browser gate verifies document visibility recovery when gameplay interval callbacks are suspended. It injects document visibility state and suppresses forwarding of the real 50ms interval callback, then removes, replaces or retains the matchmaking provider during a pending, failed or empty search.

All 36 cases pass: desktop/mobile, production/development React and all provider/search combinations. Twenty-four retired-provider cases clear stale discovery through the actual visibility listener while interval callback counts remain unchanged. Late old matched responses cannot revive discovery. Twelve unchanged-provider controls retain their valid pending or retry state; pending controls can still accept their own matched response.

The actual development StrictMode surface records two session setups and one replay cleanup in all eighteen development cases. Production wrappers record one setup and no replay cleanup. These counts verify the selected runtime rather than inferring replay from a StrictMode wrapper alone.

A negative bundle control removes the visible-session tick call. With interval callbacks suspended, retired discovery fails the 1.5-second observation deadline. This distinguishes visibility recovery from ordinary timer cleanup. No production change was required; existing behavior meets this boundary.

This is an injected browser visibility/scheduling test, not an OS-level or real background-tab suspension test. Logs and observed source hashes are in `artifacts/race-visibility-retirement/verification-held.json`. The manifest retains previous checks and adds production/development visibility checks, for 65 checks. This verifier-only batch does not claim fresh complete-client or isolated-build runs, whole-source stability, or a guarded compilation digest.

The other user-owned chat's accepted-run recovery work remains in progress, so full-source dashboard completion is pending. No hosted Jest update, game publication or Firebase deployment occurred in this batch. The broader multiplayer reliability audit remains active.
