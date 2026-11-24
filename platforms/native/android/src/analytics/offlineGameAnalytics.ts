import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import type {LocalSoloAuthority} from "../../../../../src/gameplay/local/LocalSoloAuthority";
import type {YouTubeGameMode} from "../../../../../src/gameplay/local/types";

type OfflineAction = "start" | "submit" | "hint" | "continue" | "finish" | "skip";
/** Logs accepted native offline actions after the shared save operation settles. */
export async function trackOfflineGameAction<Result>(authority: LocalSoloAuthority, action: OfflineAction,
  operation: () => Promise<Result>, selectedMode?: YouTubeGameMode): Promise<Result> {
  const before = authority.getSnapshot();
  const mode = selectedMode ?? before.save.activeGame?.mode ?? "classic";
  const params = {game_mode: mode === "daily" ? "challenge" : mode, play_surface: "offline"};
  trackEvent("game_action_requested", {...params, action});
  let result: Result;
  try {result = await operation();}
  catch (error) {trackEvent("game_action_failed", {...params, action}); throw error;}
  const after = authority.getSnapshot();
  const events: Record<OfflineAction, string> = {
    start: "level_start", submit: "guess_submitted", hint: "hint_used", continue: "continue_used", finish: "continue_declined", skip: "riddle_skipped",
  };
  trackEvent(events[action], {...params, ...(action === "submit" ? {
    attempts: after.lastResult?.attempts ?? after.save.activeGame?.attemptsUsed ?? 0,
    success: after.lastResult?.kind === "win",
  } : {})});
  if (after.lastResult && after.lastResult !== before.lastResult) {
    trackEvent("level_end", {...params, result: after.lastResult.kind, attempts: after.lastResult.attempts,
      success: after.lastResult.kind === "win"});
    if (after.lastResult.coinsEarned > 0) trackEvent("earn_virtual_currency", {virtual_currency_name: "coins", value: after.lastResult.coinsEarned, source: "offline_game"});
    for (const achievement of after.lastResult.newlyUnlockedAchievementIds) trackEvent("unlock_achievement", {achievement_id: achievement});
    if (after.save.progression.level > before.save.progression.level) trackEvent("level_up", {level: after.save.progression.level});
  }
  return result;
}
