import {useEffect, useRef, useState} from "react";
import type {ChangeEvent, FormEvent} from "react";
import coinUrl from "../../../../assets/images/coin.svg";
import treasureChestUrl from "../../../../assets/images-web/chest-open.webp";
import {ACHIEVEMENT_DEFINITIONS, type AchievementPlayerData} from "./achievements";
import type {GameModal, GameSessionState} from "./gameSession";
import {LANGUAGE_OPTIONS, setLocale, tr, type Locale} from "./i18n";
import {getNextRankForLevel, getRankForLevel, PLAYER_RANKS} from "./ranks";
import {RankIcon} from "./RankIcon";

const LEADERBOARD_PAGE_SIZE = 10;
const xpForLevel = (level: number) => {
  const completed = Math.max(0, level - 1);
  return completed * 100 + ((completed - 1) * completed * 10) / 2;
};

export function GameModalPages({state, onClose, onContinue, onPurchase, onOpenModal, onToggleMute,
  onRequestHint, onRequestSkip, onRequestLeaderboard, onUpdateUsername, onUpdateAvatar}: {
  state: GameSessionState;
  onClose: () => void;
  onContinue: (amount?: number) => void;
  onPurchase: (productId: string) => void;
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  onToggleMute: () => void;
  onRequestHint: () => void;
  onRequestSkip: () => void;
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak") => void;
  onUpdateUsername: (username: string) => void;
  onUpdateAvatar: (file: File) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const profile = state.profile;
  const rank = getRankForLevel(profile?.level ?? 1);
  const nextRank = getNextRankForLevel(profile?.level ?? 1);
  const currentThreshold = xpForLevel(profile?.level ?? 1);
  const nextThreshold = xpForLevel((profile?.level ?? 1) + 1);
  const xpProgress = Math.min(100, Math.max(0,
    (((profile?.xp ?? 0) - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100));
  const achievementPlayer: AchievementPlayerData = {
    coins: profile?.coins ?? 0,
    hasPurchasedApp: profile?.hasPurchasedApp ?? false,
    progress: {
      classicIndex: profile?.classicIndex ?? 1,
      dailyChallengeIndex: profile?.dailyChallengeIndex ?? 0,
      dailyChallengeCurrentQuestion: profile?.dailyChallengeCurrentQuestion ?? 0,
    },
    stats: {
      xp: profile?.xp ?? 0, level: profile?.level ?? 1,
      dailyPuzzlesCompleted: profile?.dailyPuzzlesCompleted ?? 0,
      bestStreak: profile?.bestStreak ?? 0, totalWordsGuessed: profile?.totalWordsGuessed ?? 0,
      winRate: profile?.winRate ?? 0, averageGuesses: profile?.averageGuesses ?? 0,
      totalScore: profile?.totalScore ?? 0, highestLevelClassic: profile?.highestLevelClassic ?? 0,
      gamesPlayed: profile?.gamesPlayed ?? 0, wins: profile?.wins ?? 0,
      challengeWins: profile?.challengeWins ?? 0, winStreak: profile?.winStreak ?? 0,
      totalWins: profile?.totalWins ?? profile?.wins ?? 0,
      totalGuessesInWins: profile?.totalGuessesInWins ?? 0, totalHintsUsed: profile?.totalHintsUsed ?? 0,
    },
  };
  const leaderboardPageCount = Math.max(1, Math.ceil(state.leaderboard.length / LEADERBOARD_PAGE_SIZE));
  const activeLeaderboardPage = Math.min(leaderboardPage, leaderboardPageCount - 1);
  const leaderboardPageStart = activeLeaderboardPage * LEADERBOARD_PAGE_SIZE;
  const visibleLeaderboardEntries = state.leaderboard.slice(leaderboardPageStart,
    leaderboardPageStart + LEADERBOARD_PAGE_SIZE);
  const skipCost = 100;

  useEffect(() => {
    if (state.modal === "leaderboard") onRequestLeaderboard(state.leaderboardType);
  }, [onRequestLeaderboard, state.leaderboardType, state.modal]);
  useEffect(() => setLeaderboardPage(0), [state.leaderboardType, state.modal]);

  const submitUsername = (event: FormEvent) => {
    event.preventDefault();
    const normalized = username.trim();
    if (normalized.length < 3) return;
    onUpdateUsername(normalized);
    setUsername("");
  };
  const chooseAvatar = () => {
    setAvatarError(null);
    if (state.user?.platformRegistered === false) {
      window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-opened"));
      return;
    }
    avatarInputRef.current?.click();
  };
  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      await onUpdateAvatar(file);
    } catch (error) {
      console.warn("[riddle-quest] Avatar selection failed", error);
      setAvatarError(tr("Profile.ALERT_AVATAR_SELECT_FAIL"));
    }
  };

  return <>
        {state.modal === "continue" && (
          <div className="modal-actions continue-actions">
            <p>{tr("LossModal.EXTRA_GO_PROMPT")}</p>
            <div className="continue-balance">
              <img src={treasureChestUrl} alt="" />
              <strong>{tr("Profile.TOTAL_COINS_LABEL")}</strong>
              <span>{(profile?.coins ?? 0).toLocaleString()}</span>
            </div>
            <button
              className="play-primary"
              disabled={(profile?.coins ?? 0) < 100}
              onClick={() => onContinue(100)}
            >
              {tr("LossModal.USE_COINS_PREFIX")}100{tr("LossModal.USE_COINS_SUFFIX")}
            </button>
            {(profile?.coins ?? 0) < 100 && (
              <p>{tr("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE")}</p>
            )}
            <button className="play-primary" onClick={() => onOpenModal("shop")}>
              {tr("LossModal.OPEN_SHOP_BUTTON")}
            </button>
            <button className="play-primary" onClick={() => onOpenModal("skip")}>
              {tr("LossModal.SKIP_PUZZLE_BUTTON")}
            </button>
          </div>
        )}

        {state.modal === "shop" && (
          <div>
            <div className="shop-balance">
              <img src={coinUrl} alt="" />
              <span>{tr("CoinShop.YOUR_BALANCE")}</span>
              <strong>{(profile?.coins ?? 0).toLocaleString()}</strong>
            </div>
            <div className="game-shop-grid">
              {state.products.length === 0 && <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p>}
              {state.products.map((product) => (
                <article
                  key={product.productId}
                  className={product.productType === "subscription" ? "shop-subscription-card" : undefined}
                >
                  {product.featuredBadge && <em>{product.featuredBadge}</em>}
                  {product.productType === "subscription"
                    ? <span className="shop-subscription-icon" aria-hidden="true">★</span>
                    : <img className="shop-product-coins" src={coinUrl} alt="" />}
                  <strong className="shop-product-name">{product.name}</strong>
                  {product.productType === "subscription" ? (
                    <span className="shop-product-amount">
                      {product.subscriptionStatus === "active"
                        ? tr("CoinShop.SUBSCRIPTION_ACTIVE")
                        : `${product.displayPrice} / ${tr(`CoinShop.PERIOD_${product.billingPeriod?.toUpperCase() ?? "MONTHLY"}`)}`}
                    </span>
                  ) : (
                    <span className="shop-product-amount">
                      {product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
                    </span>
                  )}
                  <small className="shop-product-description">{product.description}</small>
                  <button
                    className="play-primary compact"
                    disabled={product.subscriptionStatus === "active"}
                    onClick={() => onPurchase(product.productId)}
                  >
                    {product.productType === "subscription" ? (
                      product.subscriptionStatus === "active"
                        ? tr("CoinShop.SUBSCRIBED_BUTTON")
                        : product.trialEligible
                          ? tr("CoinShop.START_TRIAL_BUTTON")
                          : tr("CoinShop.SUBSCRIBE_BUTTON")
                    ) : (
                      <>
                        <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>
                        {product.displayPrice}
                      </>
                    )}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {state.modal === "profile" && (
          <div className="profile-page">
            <div className="profile-hero">
              <div className="profile-identity" data-tooltip="profileIdentity">
                <button
                  type="button"
                  className="profile-avatar-button"
                  aria-label={
                    state.user?.platformRegistered === false
                      ? tr("Profile.UPGRADE_ACCOUNT_BUTTON")
                      : tr("Profile.UPLOAD_FROM_LIBRARY_BUTTON")
                  }
                  onClick={chooseAvatar}
                >
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="profile-avatar-fallback" aria-hidden="true">
                      {(profile?.username ?? tr("Profile.GUEST_USERNAME")).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="profile-avatar-edit" aria-hidden="true">＋</span>
                </button>
                <input
                  ref={avatarInputRef}
                  className="profile-avatar-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void selectAvatar(event)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                {avatarError ? <small className="profile-avatar-error" role="alert">{avatarError}</small> : null}
                <div>
                  <strong>{profile?.username ?? tr("Profile.GUEST_USERNAME")}</strong>
                  <button className="play-text-button" onClick={() => onOpenModal("username")}>
                    {tr("Profile.EDIT_BUTTON")}
                  </button>
                </div>
              </div>
              <section className="rank-card" data-tooltip="profileProgression">
                <span className="rank-emblem" style={{background: rank.color}}>
                  <RankIcon name={rank.icon} />
                </span>
                <div>
                  <small>{tr("Ranks.CURRENT_RANK")}</small>
                  <strong>{tr(rank.nameKey)}</strong>
                  <p>{tr(rank.descriptionKey)}</p>
                </div>
              </section>
              <div className="xp-progress">
                <span>{tr("Profile.XP_LEVEL_PREFIX")}{profile?.level ?? 1}</span>
                <div><i style={{width: `${xpProgress}%`}} /></div>
                <span>{profile?.xp ?? 0} {tr("StatsModal.XP")}</span>
              </div>
              {nextRank && (
                <p className="next-rank">{tr("Ranks.NEXT_RANK_PREFIX")} {tr(nextRank.nameKey)} {tr("Ranks.AT_LEVEL_PREFIX")} {nextRank.minimumLevel}</p>
              )}
            </div>
            <dl className="profile-stats" data-tooltip="profileStats">
              <div><dt>{tr("Profile.TOTAL_COINS_LABEL")}</dt><dd>{profile?.coins ?? 0}</dd></div>
              <div><dt>{tr("Profile.TOTAL_WINS_STAT")}</dt><dd>{profile?.totalWins ?? profile?.wins ?? 0}</dd></div>
              <div><dt>{tr("Profile.BEST_STREAK_STAT")}</dt><dd>{profile?.bestStreak ?? 0}</dd></div>
              <div data-tooltip="profileDailyPuzzles"><dt>{tr("Profile.DAILY_PUZZLES_STAT")}</dt><dd>{profile?.dailyPuzzlesCompleted ?? 0}</dd></div>
            </dl>
            <div className="profile-links">
              <button data-tooltip="profileStatistics" onClick={() => onOpenModal("statistics")}>{tr("StatsModal.TITLE")}</button>
              <button data-tooltip="profileAchievements" onClick={() => onOpenModal("achievements")}>{tr("Achievements.MODAL_TITLE")}</button>
              <button
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenModal("ranks");
                }}
              >
                {tr("Ranks.TITLE")}
              </button>
              <button data-tooltip="profileLeaderboard" onClick={() => onOpenModal("leaderboard")}>{tr("Leaderboard.TITLE")}</button>
              <button data-tooltip="profileTreasure" onClick={() => onOpenModal("treasure")}>{tr("Profile.TREASURE_CHEST_TITLE")}</button>
            </div>
          </div>
        )}

        {state.modal === "settings" && (
          <div className="settings-page">
            <button className="settings-row" onClick={onToggleMute}>
              <span>{tr("Settings.SOUND_TOGGLE")}</span>
              <strong>{state.muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}</strong>
            </button>
            <label className="settings-row">
              <span>{tr("Settings.LANGUAGE_LABEL")}</span>
              <select
                value={state.locale}
                onChange={(event) => {
                  const locale = event.target.value as Locale;
                  localStorage.setItem("appLanguage", locale);
                  setLocale(locale);
                }}
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.code} value={language.code}>{language.label}</option>
                ))}
              </select>
            </label>
            <button className="settings-row" onClick={() => onOpenModal("instructions")}>
              <span>{tr("Settings.HELP_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("credits")}>
              <span>{tr("Settings.CREDITS_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("about")}>
              <span>{tr("Settings.ABOUT_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("shop")}>
              <span>{tr("Navigation.BUY_COINS_BUTTON")}</span><strong>›</strong>
            </button>
          </div>
        )}

        {state.modal === "achievements" && (
          <div className="achievement-grid">
            {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
              const unlocked = profile?.achievements.includes(achievement.id) ?? false;
              const progress = unlocked
                ? achievement.threshold
                : Math.min(achievement.threshold, achievement.getProgress(achievementPlayer));
              return (
                <article className={unlocked ? "unlocked" : ""} key={achievement.id}>
                  <span className="achievement-icon">{achievement.icon}</span>
                  <div>
                    <strong>{achievement.name}</strong>
                    <p>{achievement.description}</p>
                    <div className="achievement-progress">
                      <i style={{width: `${(progress / achievement.threshold) * 100}%`}} />
                    </div>
                    <small>{progress}/{achievement.threshold}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {state.modal === "statistics" && (
          <dl className="full-stat-grid">
            {[
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
            ].map(([label, value]) => (
              <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        )}

        {state.modal === "ranks" && (
          <div className="rank-list">
            {PLAYER_RANKS.map((item) => (
              <article className={item.id === rank.id ? "current" : ""} key={item.id}>
                <span className="rank-emblem" style={{background: item.color}}>
                  <RankIcon name={item.icon} />
                </span>
                <div><strong>{tr(item.nameKey)}</strong><p>{tr(item.descriptionKey)}</p></div>
                <small>{tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}{item.minimumLevel}</small>
              </article>
            ))}
          </div>
        )}

        {state.modal === "leaderboard" && (
          <div className="leaderboard-panel">
            <div className="leaderboard-tabs">
              {(["xp", "totalWins", "bestStreak"] as const).map((type) => (
                <button
                  className={state.leaderboardType === type ? "active" : ""}
                  key={type}
                  onClick={() => onRequestLeaderboard(type)}
                >
                  {tr(type === "xp" ? "Leaderboard.TAB_XP" : type === "totalWins" ? "Leaderboard.TAB_WINS" : "Leaderboard.TAB_STREAK")}
                </button>
              ))}
            </div>
            <ol className="leaderboard-list" aria-busy={state.leaderboardLoading}>
              {!state.leaderboardLoading && state.leaderboard.length === 0 && (
                <li>{tr("Leaderboard.NO_SCORES_YET")}</li>
              )}
              {!state.leaderboardLoading && visibleLeaderboardEntries.map((entry, index) => (
                <li key={entry.userId}>
                  <b>{leaderboardPageStart + index + 1}</b>
                  {entry.avatarUrl ? (
                    <img
                      className="leaderboard-avatar"
                      src={entry.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="leaderboard-avatar-fallback" aria-hidden="true">
                      {entry.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>{entry.username}</span>
                  <strong>{state.leaderboardType === "xp" ? entry.xp : state.leaderboardType === "totalWins" ? entry.totalWins : entry.bestStreak}</strong>
                </li>
              ))}
            </ol>
            {!state.leaderboardLoading && state.leaderboard.length > LEADERBOARD_PAGE_SIZE && (
              <nav className="leaderboard-pagination" aria-label={tr("Leaderboard.PAGINATION_LABEL")}>
                <button
                  className="play-secondary compact"
                  disabled={activeLeaderboardPage === 0}
                  onClick={() => setLeaderboardPage((page) => Math.max(0, page - 1))}
                >
                  {tr("Leaderboard.PREVIOUS_PAGE")}
                </button>
                <span>{activeLeaderboardPage + 1} / {leaderboardPageCount}</span>
                <button
                  className="play-secondary compact"
                  disabled={activeLeaderboardPage === leaderboardPageCount - 1}
                  onClick={() => setLeaderboardPage((page) => Math.min(leaderboardPageCount - 1, page + 1))}
                >
                  {tr("Leaderboard.NEXT_PAGE")}
                </button>
              </nav>
            )}
          </div>
        )}

        {state.modal === "instructions" && (
          <div className="instructions-page">
            <p>{tr("Instructions.GOAL_DESCRIPTION")}</p>
            <h3>{tr("Instructions.COLOR_CLUES_TITLE")}</h3>
            <p><i className="clue green">A</i>{tr("Instructions.COLOR_CORRECT")}</p>
            <p><i className="clue yellow">B</i>{tr("Instructions.COLOR_MISPLACED")}</p>
            <p><i className="clue red">C</i>{tr("Instructions.COLOR_WRONG")}</p>
            <h3>{tr("Instructions.TIPS_TITLE")}</h3>
            <p>{tr("Instructions.TIPS_DESCRIPTION")}</p>
            <button className="play-primary" onClick={onClose}>{tr("Instructions.GOT_IT_BUTTON")}</button>
          </div>
        )}

        {state.modal === "hint" && (
          <div className="modal-actions">
            <p>{tr("GameScreenAlerts.COST_COINS_PREFIX")}50{tr("GameScreenAlerts.COST_COINS_SUFFIX")}</p>
            {(profile?.coins ?? 0) >= 50 ? (
              <button className="play-primary" onClick={() => { onRequestHint(); onClose(); }}>
                {tr("GameScreenAlerts.HINT_SHOW_BUTTON")}
              </button>
            ) : (
              <>
                <p>{tr("GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE")}</p>
                <button className="play-primary" onClick={() => onOpenModal("shop")}>
                  {tr("LossModal.OPEN_SHOP_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "skip" && state.gameMode === "classic" && (
          <div className="modal-actions">
            <p>{tr("GameScreenAlerts.COST_COINS_PREFIX")}{skipCost}{tr("GameScreenAlerts.COST_COINS_SUFFIX")}</p>
            {(profile?.coins ?? 0) >= skipCost ? (
              <button className="play-primary" onClick={() => { onRequestSkip(); onClose(); }}>
                {tr("GameScreenAlerts.SKIP_LEVEL_BUTTON")}
              </button>
            ) : (
              <>
                <p>{tr("GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE")}</p>
                <button className="play-primary" onClick={() => onOpenModal("shop")}>
                  {tr("LossModal.OPEN_SHOP_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "username" && (
          <form className="username-form" onSubmit={submitUsername}>
            <label>
              {tr("Profile.USERNAME_LABEL")}
              <input
                autoFocus
                minLength={3}
                maxLength={24}
                value={username}
                placeholder={tr("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <button className="play-primary" disabled={username.trim().length < 3}>
              {tr("Profile.SAVE_BUTTON")}
            </button>
          </form>
        )}

        {state.modal === "credits" && (
          <div className="credits-list">
            <p>{tr("Credits.SUBTITLE")}</p>
            {[
              ["Craig Beswetherick", "Lead Developer & Game Design"],
              ["Reuben Beswetherick", "Inspiration"],
              ["Mike Hawkyard", "Game Designer, Publisher, Overall Hero"],
              ["Gavin Harrison", "Sound Design"],
              ["Nathalia", "Design"],
              ["Mr Ben", "Design"],
            ].map(([name, role]) => <article key={name}><strong>{name}</strong><span>{role}</span></article>)}
            <h3>{tr("Credits.THANK_YOU_TITLE")}</h3>
            <p>{tr("Credits.THANK_YOU_TEXT")}</p>
          </div>
        )}

        {state.modal === "about" && (
          <div className="about-list">
            {[
              "RIDDLE_QUEST_WEBSITE",
              "PRIVACY_POLICY",
              "TERMS_OF_USE",
              "ACCOUNT_DELETION",
              "DATA_EXPORT",
              "THIRD_PARTY_LICENSES",
              "SUPPORT",
            ].map((key) => <div key={key}>{tr(`AboutLegal.${key}`)}</div>)}
          </div>
        )}

        {state.modal === "treasure" && (
          <div className="treasure-chest">
            <img src={treasureChestUrl} alt="" />
            <strong>{(profile?.coins ?? 0).toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</strong>
            <button className="play-primary" onClick={() => onOpenModal("shop")}>
              {tr("Navigation.BUY_COINS_BUTTON")}
            </button>
          </div>
        )}
  </>;
}
