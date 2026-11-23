import {getYouTubeAchievementIcon} from "./achievements";
import {youtubeText, type YouTubeCopyKey} from "./i18n";
import type {YouTubeAuthoritySnapshot} from "./LocalSoloAuthority";
import type {YouTubeLocale} from "./types";
/** Renders one locally bundled achievement icon with a meaningful label. */
export function AchievementIcon({
  id,
  text,
}: {
  /** Stores id. */
  id: string;
  /** Stores text. */
  text: (key: YouTubeCopyKey) => string;
}) {
  /** Provides numeric behavior. */
  const numeric = Number(id.match(/\d+/u)?.[0]);
  /** Provides label behavior. */
  let label: string;
  if (id === "first_win") label = `${text("wins")}: 1`;
  else if (id.startsWith("wins_")) label = `${text("wins")}: ${numeric}`;
  else if (id.startsWith("games_")) label = `${text("games")}: ${numeric}`;
  else if (id.startsWith("streak_")) label = `${text("streak")}: ${numeric}`;
  else if (id.startsWith("classic_")) label = `${text("classic")}: ${numeric || 1}`;
  else if (id.startsWith("daily_") || id.startsWith("challenge_")) label = `${text("daily")}: ${numeric || 1}`;
  else if (id.startsWith("hints_") || id === "hint_user") label = `${text("hint")}: ${numeric || 1}`;
  else if (id.startsWith("level_")) label = `${text("level")}: ${numeric}`;
  else if (id.startsWith("xp_")) label = `${text("xp")}: ${numeric}`;
  else if (id === "coin_hoarder") label = `${text("coins")}: 1000`;
  else if (id === "treasure_vault") label = `${text("coins")}: 2500`;
  else if (id === "win_rate_80") label = `${text("wins")}: 80%`;
  else if (id === "efficient_10") label = `${text("wins")}: 10 · ${text("attempts")}: 3`;
  else if (id === "lesson_learned") label = text("loss");
  else label = `${text("achievements")}: ${text("attempts")} ${id.includes("last_chance") ? 5 : 1}`;
  return (
    <span role="img" aria-label={label}>
      {getYouTubeAchievementIcon(id)}
    </span>
  );
}
/** Renders the persistent YouTube player economy and save status. */
export function StatusHeader({
  snapshot,
  locale,
}: {
  /** Stores snapshot. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Stores locale. */
  locale: YouTubeLocale;
}) {
  return (
    <header className="yt-status">
      <strong>{youtubeText(locale, "title")}</strong>
      <span>🪙 {snapshot.save.progression.coins}</span>
      {snapshot.busy && <span role="status">{youtubeText(locale, "saving")}</span>}
    </header>
  );
}
/** Renders the recoverable YouTube save failure action. */
export function SaveBanner({
  text,
  retry,
}: {
  /** Stores text. */
  text: (key: YouTubeCopyKey) => string;
  /** Stores retry. */
  retry: () => void;
}) {
  return (
    <div className="yt-banner error" role="alert">
      <span>{text("saveFailed")}</span>
      <button onClick={retry}>{text("retry")}</button>
    </div>
  );
}
