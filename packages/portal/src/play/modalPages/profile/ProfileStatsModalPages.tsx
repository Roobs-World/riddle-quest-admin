import {ACHIEVEMENT_DEFINITIONS} from "../../achievements";
import type {GameSessionState} from "../../gameSession";
import {tr} from "../../i18n";
import {getRankForLevel, PLAYER_RANKS} from "../../ranks";
import {RankIcon} from "../../RankIcon";
import {createAchievementPlayer} from "./profileStats";

/** Shared properties for profile-derived detail pages. */
export type ProfileStatsModalPageProps = {
  /** Latest profile returned by the trusted host, or null for guest defaults. */
  profile: GameSessionState["profile"];
};

/** Renders achievement unlock and progress state derived from the current profile. */
export function AchievementsModalPage({profile}: ProfileStatsModalPageProps) {
  /** Achievement evaluation input projected from the bridge profile. */
  const achievementPlayer = createAchievementPlayer(profile);

  return (
    <div className="achievement-grid">
      {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
        /** Whether the trusted profile records this achievement as unlocked. */
        const unlocked = profile?.achievements.includes(achievement.id) ?? false;
        /** Clamped progress displayed for this achievement. */
        const progress = unlocked
          ? achievement.threshold
          : Math.min(achievement.threshold, achievement.getProgress(achievementPlayer));
        return (
          <article className={unlocked ? "unlocked" : ""} key={achievement.id}>
            <span className="achievement-icon">{achievement.icon}</span>
            <div>
              <strong>{achievement.nameKey ? tr(achievement.nameKey) : achievement.name}</strong>
              <p>{achievement.descriptionKey ? tr(achievement.descriptionKey) : achievement.description}</p>
              <div className="achievement-progress">
                <i style={{width: `${(progress / achievement.threshold) * 100}%`}} />
              </div>
              <small>
                {progress}/{achievement.threshold}
              </small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Renders the complete server-backed player statistics grid. */
export function StatisticsModalPage({profile}: ProfileStatsModalPageProps) {
  /** Label and value pairs displayed in the statistics grid. */
  const statistics: Array<[string, string | number]> = [
    [tr("StatsModal.GAMES_PLAYED"), profile?.gamesPlayed ?? 0],
    [tr("StatsModal.TOTAL_WINS"), profile?.totalWins ?? profile?.wins ?? 0],
    [tr("StatsModal.CHALLENGE_WINS"), profile?.challengeWins ?? 0],
    [tr("StatsModal.CURRENT_STREAK"), profile?.winStreak ?? 0],
    [tr("StatsModal.BEST_STREAK"), profile?.bestStreak ?? 0],
    [tr("StatsModal.DAILY_PUZZLES"), profile?.dailyPuzzlesCompleted ?? 0],
    [tr("StatsModal.TOTAL_WORDS_GUESSED"), profile?.totalWordsGuessed ?? 0],
    [tr("StatsModal.WIN_RATE"), `${Math.round(profile?.winRate ?? 0)}%`],
    [tr("StatsModal.AVG_GUESSES"), (profile?.averageGuesses ?? 0).toFixed(1)],
    [tr("StatsModal.TOTAL_SCORE"), profile?.totalScore ?? 0],
    [tr("StatsModal.HIGHEST_CLASSIC_LEVEL"), profile?.highestLevelClassic ?? 0],
    [tr("StatsModal.HINTS_USED"), profile?.totalHintsUsed ?? 0],
    [tr("StatsModal.XP"), profile?.xp ?? 0],
    [tr("Profile.XP_LEVEL_PREFIX"), profile?.level ?? 1],
  ];

  return (
    <dl className="full-stat-grid">
      {statistics.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Renders every rank and highlights the rank matching the current profile level. */
export function RanksModalPage({profile}: ProfileStatsModalPageProps) {
  /** Rank associated with the profile or default guest level. */
  const currentRank = getRankForLevel(profile?.level ?? 1);

  return (
    <div className="rank-list">
      {PLAYER_RANKS.map((rank) => (
        <article className={rank.id === currentRank.id ? "current" : ""} key={rank.id}>
          <span className="rank-emblem" style={{background: rank.color}}>
            <RankIcon name={rank.icon} />
          </span>
          <div>
            <strong>{tr(rank.nameKey)}</strong>
            <p>{tr(rank.descriptionKey)}</p>
          </div>
          <small>
            {tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}
            {rank.minimumLevel}
          </small>
        </article>
      ))}
    </div>
  );
}
