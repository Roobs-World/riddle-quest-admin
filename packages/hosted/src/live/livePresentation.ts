import type {LiveRaceView} from "@riddle-quest/core/race";

/** Clock anchors stay private when a poll changes no visible gameplay or action availability. */
export function livePresentationKey(view: LiveRaceView): string {
  /** Viewer facts compared independently of the private server-time anchor. */
  const {serverNowMs: _serverNowMs, run, ...frame} = view;
  if (!run) return JSON.stringify({...frame, run: null});
  /** Run progress retained while elapsed clocks advance privately. */
  const {serverNowMs: _runNowMs, wallElapsedMs: _wallElapsedMs, adjustedElapsedMs: _adjustedElapsedMs, ...progress} = run;
  return JSON.stringify({...frame, run: progress});
}
