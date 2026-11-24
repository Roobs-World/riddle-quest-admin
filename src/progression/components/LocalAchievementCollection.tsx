import {achievementText} from "../../localization/copy/achievementCopy";
import {youtubeText} from "../../localization/copy/localGameCopy";
import type {YouTubeLocale, YouTubeProgress} from "../../gameplay/local/types";
import {LOCAL_ACHIEVEMENT_DEFINITIONS} from "../achievements/localAchievements";
import {createLocalAchievementPlayer, getAchievementProgressViews, orderAchievementDefinitions} from "../achievements/achievementPresentation";

const definitions = LOCAL_ACHIEVEMENT_DEFINITIONS;

/** Offline hosts show only goals their local gameplay authority can award. */
export function LocalAchievementCollection({locale, progress}: {locale: YouTubeLocale; progress: YouTubeProgress}) {
  const player = createLocalAchievementPlayer(progress);
  const unlocked = new Set(progress.unlockedAchievementIds);
  const count = definitions.filter(({id}) => unlocked.has(id)).length;
  return <details className="yt-achievement-collection">
    <summary>{youtubeText(locale, "achievements")} <strong>{count} / {definitions.length}</strong></summary>
    <div className="yt-achievement-list">
      {orderAchievementDefinitions(definitions, player, progress.unlockedAchievementIds).map((definition) => {
        const earned = unlocked.has(definition.id);
        const name = achievementText(locale, definition.nameKey ?? "", definition.name);
        return <article key={definition.id} className={earned ? "earned" : ""}>
          <span className="yt-achievement-icon" aria-hidden="true">{definition.icon}</span>
          <div>
            <h3>{name}</h3>
            <p>{achievementText(locale, definition.descriptionKey ?? "", definition.description)}</p>
            {getAchievementProgressViews(definition, player, earned).map((requirement, index) => <div key={index}>
              <small>{requirement.labelKey ? `${achievementText(locale, requirement.labelKey)}: ` : ""}{requirement.text}</small>
              <div className="yt-achievement-bar" role="progressbar"
                aria-label={requirement.labelKey ? `${name}: ${achievementText(locale, requirement.labelKey)}` : name}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(requirement.ratio * 100)}
                aria-valuetext={requirement.text}>
                <i style={{width: `${requirement.ratio * 100}%`}} />
              </div>
            </div>)}
            {earned && <small className="yt-achievement-status">✓ {achievementText(locale, "Achievements.UNLOCKED_LABEL")}</small>}
          </div>
        </article>;
      })}
    </div>
  </details>;
}
