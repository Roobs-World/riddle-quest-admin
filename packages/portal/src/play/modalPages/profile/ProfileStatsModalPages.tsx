import {ACHIEVEMENT_DEFINITIONS} from "../../achievements";
import type {GameSessionState} from "../../gameSession";
import {useTranslator} from "../../i18n";
import {getNextRankForLevel, getRankForLevel, PLAYER_RANKS, RANK_MATERIAL_ORDER} from "../../ranks";
import {RankedAvatar} from "../../RankedAvatar";
import {RankIcon} from "../../RankIcon";
import {createAchievementPlayer} from "./profileStats";

/** Shared properties for profile-derived detail pages. */
export type ProfileStatsModalPageProps = {
  /** Latest profile returned by the trusted host, or null for guest defaults. */
  profile: GameSessionState["profile"];
};

/** Renders achievement unlock and progress state derived from the current profile. */
export function AchievementsModalPage({profile}: ProfileStatsModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Achievement evaluation input projected from the bridge profile. */
  const achievementPlayer = createAchievementPlayer(profile);
  /** Counts only recognized achievements recorded by the trusted profile. */
  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((achievement) => profile?.achievements.includes(achievement.id)).length;

  return (
    <div className="achievements-page">
      <div className="profile-detail-hero achievement-summary">
        <span className="profile-detail-emblem" aria-hidden="true">🏆</span>
        <div>
          <span className="profile-detail-eyebrow">{tr("Achievements.UNLOCKED_LABEL")}</span>
          <strong className="profile-detail-total">{unlockedCount} <span>/ {ACHIEVEMENT_DEFINITIONS.length}</span></strong>
        </div>
        <div className="achievement-progress" role="progressbar" aria-label={tr("Achievements.MODAL_TITLE")}
          aria-valuemin={0} aria-valuemax={ACHIEVEMENT_DEFINITIONS.length} aria-valuenow={unlockedCount}>
          <i style={{width: `${unlockedCount / ACHIEVEMENT_DEFINITIONS.length * 100}%`}} />
        </div>
      </div>
      <div className="achievement-grid">
      {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
        /** Whether the trusted profile records this achievement as unlocked. */
        const unlocked = profile?.achievements.includes(achievement.id) ?? false;
        /** Clamped progress displayed for this achievement. */
        const progress = unlocked
          ? achievement.threshold
          : Math.max(0, Math.min(achievement.threshold, achievement.getProgress(achievementPlayer)));
        /** Localized title also names the accessible progress indicator. */
        const name = achievement.nameKey ? tr(achievement.nameKey) : achievement.name;
        return (
          <article className={unlocked ? "unlocked" : ""} key={achievement.id}>
            <span className="achievement-icon" aria-hidden="true">{achievement.icon}</span>
            <div className="achievement-details">
              <h3 className="profile-card-title">{name}</h3>
              <p>{achievement.descriptionKey ? tr(achievement.descriptionKey) : achievement.description}</p>
              <div className="achievement-progress" role="progressbar" aria-label={name}
                aria-valuemin={0} aria-valuemax={achievement.threshold} aria-valuenow={progress}>
                <i style={{width: `${(progress / achievement.threshold) * 100}%`}} />
              </div>
              <div className="achievement-meta">
                <small>{progress} / {achievement.threshold}</small>
                {unlocked ? <small className="achievement-status"><span aria-hidden="true">✓ </span>{tr("Achievements.UNLOCKED_LABEL")}</small> : null}
              </div>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}

/** Renders the complete server-backed player statistics grid. */
export function StatisticsModalPage({profile}: ProfileStatsModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
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
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Rank associated with the profile or default guest level. */
  const currentRank = getRankForLevel(profile?.level ?? 1);
  /** Current level and next threshold describe the player's rank journey. */
  const level = profile?.level ?? 1;
  /** Next rank threshold defines the remaining level progress, or is absent at the final rank. */
  const nextRank = getNextRankForLevel(level);
  /** Progress through the current rank, capped for the final rank. */
  const rankProgress = nextRank ? Math.max(0, Math.min(100, (level - currentRank.minimumLevel) / (nextRank.minimumLevel - currentRank.minimumLevel) * 100)) : 100;

  return (
    <div className="ranks-page">
      <div className="profile-detail-hero rank-summary">
        <RankedAvatar size={64} level={currentRank.minimumLevel} fallback={<RankIcon name={currentRank.icon} />} showSymbolBadge={false} />
        <div>
          <span className="profile-detail-eyebrow">{tr("Ranks.CURRENT_RANK")}</span>
          <strong>{tr(currentRank.nameKey)}</strong>
          <span className="rank-material" data-rank-material={currentRank.material}>{tr(currentRank.materialKey)}</span>
          <span className="rank-summary-level">{tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}{level}</span>
        </div>
        <div className="rank-summary-progress">
          <div className="achievement-progress" role="progressbar" aria-label={tr("Ranks.CURRENT_RANK")}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rankProgress)}>
            <i style={{width: `${rankProgress}%`}} />
          </div>
          <p>{nextRank ? <>{tr("Ranks.NEXT_RANK_PREFIX")} {tr(nextRank.nameKey)} {tr("Ranks.AT_LEVEL_PREFIX")} {nextRank.minimumLevel}</> : tr("Ranks.HIGHEST_RANK")}</p>
        </div>
      </div>
      <p className="rank-introduction">{tr("Ranks.SUBTITLE")}</p>
      <div className="rank-list">
        {RANK_MATERIAL_ORDER.map(material => {
          /** Ordered milestones belonging to this metal tier. */
          const ranks = PLAYER_RANKS.filter(rank => rank.material === material);
          return <section className="rank-material-section" key={material} data-rank-material={material}>
            <h3 className="rank-material-heading">{tr(ranks[0].materialKey)}</h3>
            {ranks.map(rank => <article className={rank.id === currentRank.id ? "current" : ""} key={rank.id}
              data-rank-id={rank.id} data-reached={level >= rank.minimumLevel}
              aria-current={rank.id === currentRank.id ? "step" : undefined}>
              <RankedAvatar size={56} level={rank.minimumLevel} fallback={<RankIcon name={rank.icon} />} showSymbolBadge={false} />
              <div>
                <h4 className="profile-card-title">{tr(rank.nameKey)}</h4>
                <p>{tr(rank.descriptionKey)}</p>
                {rank.id === currentRank.id ? <span className="rank-current-label">{tr("Ranks.CURRENT_RANK")}</span> : null}
              </div>
              <small>{tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}{rank.minimumLevel}</small>
            </article>)}
          </section>;
        })}
      </div>
    </div>
  );
}
