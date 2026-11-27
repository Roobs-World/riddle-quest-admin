import {SOLO_ACHIEVEMENT_DEFINITIONS} from "../../../progression/achievements/catalog/soloAchievements";
import {achievementText} from "../../../localization/copy/achievementCopy";
import {youtubeText, type YouTubeCopyKey} from "../../../localization/copy/localGameCopy";
import {type YouTubeAuthoritySnapshot} from "../../local/LocalSoloAuthority.contract.ts";
import type {YouTubeLocale} from "../../../platform/contracts/localGamePolicy";
/** Earned badge with the actual localized name and requirement. */
export function AchievementIcon({id, locale}: {id: string; locale: YouTubeLocale}) {
  const definition = SOLO_ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === id);
  const name = definition ? achievementText(locale, definition.nameKey, definition.name) : youtubeText(locale, "achievements");
  const description = definition ? achievementText(locale, definition.descriptionKey, definition.description) : "";
  return <div className="yt-earned-badge">
    <span role="img" aria-label={name}>{definition?.icon ?? "🏅"}</span>
    <strong>{name}</strong>
    {description && <small>{description}</small>}
  </div>;
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
