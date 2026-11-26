import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import {SOLO_COIN_COSTS} from "../../../../../src/progression/economy/rewardRules";
import type {LocalSoloAuthority} from "../../../../../src/gameplay/local/LocalSoloAuthority";
import type {YouTubeGameMode} from "../../../../../src/gameplay/local/types";
import {startAndroidAnalyticsTiming} from "./androidAnalytics";

type OfflineAction = "start" | "submit" | "hint" | "continue" | "finish" | "skip";
/** Logs accepted native offline actions after the shared save operation settles. */
export async function trackOfflineGameAction<Result>(authority: LocalSoloAuthority, action: OfflineAction,
  operation: () => Promise<Result>, selectedMode?: YouTubeGameMode): Promise<Result> {
  const before = authority.getSnapshot();
  const mode = selectedMode ?? before.save.activeGame?.mode ?? "classic";
  const params = {game_mode: mode === "daily" ? "challenge" : mode, play_surface: "offline"};
  const timing = startAndroidAnalyticsTiming();
  trackEvent("game_action_requested", {...params, action});
  let result: Result;
  try {result = await operation();}
  catch (error) {
    trackEvent("operation_timing", {...params, operation: `game_${action}`, status: "failed", ...timing()});
    trackEvent("game_action_failed", {...params, action});
    throw error;
  }
  const after = authority.getSnapshot();
  if (after.save.revision === before.save.revision) {
    trackEvent("operation_timing", {...params, operation: `game_${action}`, status: "not_applied", ...timing()});
    return result;
  }
  trackEvent("operation_timing", {...params, operation: `game_${action}`, status: "success", ...timing()});
  const content = action === "start" ? after : before;
  const dimensions = {...params, content_version: content.save.contentVersion, category_id: content.activeRiddle?.categoryId,
    difficulty: content.activeRiddle?.difficultyBand, word_length: content.displayLetters?.length};
  const events: Record<OfflineAction, string> = {
    start: "level_start", submit: "guess_submitted", hint: "hint_used", continue: "continue_used", finish: "continue_declined", skip: "riddle_skipped",
  };
  trackEvent(events[action], {...dimensions, ...(action === "submit" ? {
    attempts: after.lastResult?.attempts ?? after.save.activeGame?.attemptsUsed ?? 0,
    success: after.lastResult?.kind === "win",
  } : {})});
  const cost = action === "hint" || action === "continue" || action === "skip" ? SOLO_COIN_COSTS[action] : 0;
  if (cost > 0) trackEvent("spend_virtual_currency", {...params, virtual_currency_name: "coins", item_name: action, value: cost});
  const coinsEarned = after.save.progression.coins - before.save.progression.coins + cost;
  if (coinsEarned > 0) trackEvent("earn_virtual_currency", {...params, virtual_currency_name: "coins", value: coinsEarned, source: "offline_game"});
  const priorAchievements = new Set(before.save.progression.unlockedAchievementIds);
  for (const achievement of after.save.progression.unlockedAchievementIds) {
    if (!priorAchievements.has(achievement)) trackEvent("unlock_achievement", {...params, achievement_id: achievement});
  }
  if (after.save.progression.level > before.save.progression.level) trackEvent("level_up", {...params, level: after.save.progression.level});
  if (after.lastResult && after.lastResult !== before.lastResult) {
    trackEvent("level_end", {...dimensions, result: after.lastResult.kind, attempts: after.lastResult.attempts,
      success: after.lastResult.kind === "win"});
  }
  return result;
}
