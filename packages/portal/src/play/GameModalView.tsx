import {useEffect, useRef, useState} from "react";
import coinUrl from "../../../../assets/images/coin.svg";
import {ACHIEVEMENT_DEFINITIONS} from "./achievements";
import type {GameModal, GameSessionState} from "./gameSession";
import {tr} from "./i18n";
import {getRankForLevel} from "./ranks";
import {RankIcon} from "./RankIcon";
import {SpinningWheel, SpinningWheelLoader} from "./SpinningWheelLoader";
import {GameModalPages} from "./GameModalPages";

export function GameModalView({
  state,
  onClose,
  onContinue,
  onPurchase,
  onNext,
  onOpenModal,
  onToggleMute,
  onRequestHint,
  onRequestSkip,
  onRequestLeaderboard,
  onUpdateUsername,
  onUpdateAvatar,
}: {
  state: GameSessionState;
  onClose: () => void;
  onContinue: (amount?: number) => void;
  onPurchase: (productId: string) => void;
  onNext: () => void;
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  onToggleMute: () => void;
  onRequestHint: () => void;
  onRequestSkip: () => void;
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak") => void;
  onUpdateUsername: (username: string) => void;
  onUpdateAvatar: (file: File) => Promise<void>;
}) {
  const [victoryStepIndex, setVictoryStepIndex] = useState(0);
  const [rewardStepIndex, setRewardStepIndex] = useState(0);
  const modalRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!state.modal) {
      return;
    }
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    modal?.scrollTo({top: 0, left: 0});
    modal?.parentElement?.scrollTo({top: 0, left: 0});
    const externalNotice = document.querySelector<HTMLElement>(".play-alert");
    if (externalNotice) {
      externalNotice.inert = true;
      externalNotice.setAttribute("aria-hidden", "true");
    }
    const getFocusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    window.requestAnimationFrame(() => getFocusable()[0]?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (state.modal !== "victory") {
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
      if (externalNotice) {
        externalNotice.inert = false;
        externalNotice.removeAttribute("aria-hidden");
      }
    };
  }, [state.lastRewards, state.modal]);

  useEffect(() => {
    setVictoryStepIndex(0);
  }, [state.lastOutcome?.id]);

  useEffect(() => {
    setRewardStepIndex(0);
  }, [state.auxiliaryFanfare?.id]);

  if (!state.modal) {
    return null;
  }

  type FanfareStep =
    | {kind: "achievement"; achievementId: string}
    | {kind: "victory"}
    | {kind: "level"}
    | {kind: "rank"}
    | {kind: "purchase"};
  const victoryLevel = state.lastRewards?.newLevel;
  const reachedNewRank =
    state.lastRewards?.leveledUp === true &&
    victoryLevel !== undefined &&
    getRankForLevel(Math.max(1, victoryLevel - 1)).id !== getRankForLevel(victoryLevel).id;
  const victorySteps: FanfareStep[] = state.lastRewards
    ? [
        ...state.lastRewards.newlyUnlockedAchievementIds.map(
          (achievementId): FanfareStep => ({kind: "achievement", achievementId}),
        ),
        {kind: "victory"},
        ...(state.lastRewards.leveledUp ? ([{kind: "level"}] as FanfareStep[]) : []),
        ...(reachedNewRank ? ([{kind: "rank"}] as FanfareStep[]) : []),
      ]
    : [];
  const auxiliarySteps: FanfareStep[] = state.auxiliaryFanfare
    ? [
        ...(state.auxiliaryFanfare.kind === "purchase" ? ([{kind: "purchase"}] as FanfareStep[]) : []),
        ...state.auxiliaryFanfare.achievementIds.map(
          (achievementId): FanfareStep => ({kind: "achievement", achievementId}),
        ),
      ]
    : [];
  const activeVictoryStep = victorySteps[Math.min(victoryStepIndex, Math.max(0, victorySteps.length - 1))];
  const activeRewardStep = auxiliarySteps[Math.min(rewardStepIndex, Math.max(0, auxiliarySteps.length - 1))];
  const titles: Record<Exclude<GameModal, null>, string> = {
    victory: tr("VictoryModal.TITLE"),
    continue: tr("LossModal.OUT_OF_ATTEMPTS"),
    shop: tr("CoinShop.TITLE"),
    profile: tr("Profile.TITLE"),
    settings: tr("Settings.TITLE"),
    leaderboard: tr("Leaderboard.TITLE"),
    achievements: tr("Achievements.MODAL_TITLE"),
    statistics: tr("StatsModal.TITLE"),
    ranks: tr("Ranks.TITLE"),
    instructions: tr("Instructions.GOAL_TITLE"),
    credits: tr("Credits.TITLE"),
    about: tr("AboutLegal.TITLE"),
    hint: tr("GameScreenAlerts.HINT_MODAL_TITLE"),
    skip: tr("GameScreenAlerts.SKIP_MODAL_TITLE"),
    username: tr("Profile.UPDATE_USERNAME_TITLE"),
    treasure: tr("Profile.TREASURE_CHEST_TITLE"),
    reward: tr("CoinPurchase.TITLE"),
  };
  const activeFanfareStep = state.modal === "victory" ? activeVictoryStep : activeRewardStep;
  if (activeFanfareStep?.kind === "achievement") {
    titles[state.modal] = tr("Achievements.FANFARE_TITLE");
  } else if (activeFanfareStep?.kind === "level") {
    titles.victory = tr("LevelUpFanfare.TITLE");
  } else if (activeFanfareStep?.kind === "rank") {
    titles.victory = tr("RankUpFanfare.TITLE");
  }

  const isMandatoryOutcome = state.modal === "victory";
  const advanceVictoryFanfare = () => {
    if (victoryStepIndex + 1 < victorySteps.length) {
      setVictoryStepIndex((index) => index + 1);
      return;
    }
    onClose();
    window.setTimeout(onNext, 220);
  };
  const advanceRewardFanfare = () => {
    if (rewardStepIndex + 1 < auxiliarySteps.length) {
      setRewardStepIndex((index) => index + 1);
      return;
    }
    onClose();
  };

  return (
    <div
      className="game-modal-backdrop"
      role="presentation"
      onMouseDown={isMandatoryOutcome ? undefined : onClose}
    >
      {state.modal !== "profile" ? <SpinningWheel /> : null}
      <section
        ref={modalRef}
        className={`game-modal modal-${state.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        data-analytics-screen={`modal_${state.modal}`}
      >
        {!isMandatoryOutcome && (
          <button className="modal-x" onClick={onClose} aria-label={tr("CommonAlerts.CLOSE_BUTTON")}>
            ×
          </button>
        )}
        <h2 id="game-modal-title">{titles[state.modal]}</h2>

        {state.modal === "victory" && (
          <div className="fanfare-content">
            <div className="fanfare-burst" aria-hidden="true">✦</div>
            {!activeVictoryStep ? (
              <p aria-live="polite">{tr("WebPortal.HOST_STATUS_WAITING")}</p>
            ) : activeVictoryStep.kind === "achievement" ? (
              <AchievementFanfare achievementId={activeVictoryStep.achievementId} />
            ) : activeVictoryStep.kind === "level" ? (
              <div className="reward-summary">
                <span className="fanfare-emblem">✦</span>
                <strong>{tr("LevelUpFanfare.LEVEL_PREFIX")}{victoryLevel}</strong>
                <span>{tr("LevelUpFanfare.PROFILE_GUIDANCE")}</span>
              </div>
            ) : activeVictoryStep.kind === "rank" ? (
              <div className="reward-summary">
                <span
                  className="rank-emblem large"
                  style={{background: getRankForLevel(victoryLevel ?? 1).color}}
                >
                  <RankIcon name={getRankForLevel(victoryLevel ?? 1).icon} />
                </span>
                <strong>{tr(getRankForLevel(victoryLevel ?? 1).nameKey)}</strong>
                <span>{tr("RankUpFanfare.SUBTITLE")}</span>
              </div>
            ) : (
              <>
                <strong className="fanfare-title">{tr("VictoryModal.YOU_WON_TITLE")}</strong>
                <div className="reward-summary">
                  <span>+{state.lastRewards?.coinsEarned ?? 0} {tr("VictoryModal.COINS_SUFFIX")}</span>
                  {state.lastRewards?.newXp !== undefined && <span>{state.lastRewards.newXp} {tr("StatsModal.XP")}</span>}
                  {state.lastRewards?.newWinStreak !== undefined && <span>🔥 {state.lastRewards.newWinStreak}</span>}
                </div>
                <button
                  className="play-secondary"
                  onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:share-referral", {
                    detail: {
                      gameMode: state.riddle?.gameMode,
                      challengeId: state.riddle?.riddleId,
                      attempts: state.guesses.length,
                      emojiGrid: state.guesses
                        .map((guess) => guess.feedback.map((feedback) =>
                          feedback === "green" ? "🟩" : feedback === "yellow" ? "🟨" : "⬛",
                        ).join(""))
                        .join("\n"),
                    },
                  }))}
                >
                  {tr("VictoryModal.SHARE_TEXT")}
                </button>
              </>
            )}
            {activeVictoryStep && (
              <>
                <small className="sequence-progress">
                  {victoryStepIndex + 1}/{victorySteps.length}
                </small>
                <button className="play-primary" onClick={advanceVictoryFanfare}>
                  {victoryStepIndex + 1 < victorySteps.length
                    ? tr("GameScreenAlerts.NEXT_BUTTON")
                    : tr("VictoryModal.NEXT_LEVEL_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "reward" && state.auxiliaryFanfare && (
          <div className="fanfare-content">
            <div className="fanfare-burst" aria-hidden="true">✦</div>
            {activeRewardStep?.kind === "purchase" ? (
              <div className="reward-summary">
                <img className="reward-coin" src={coinUrl} alt="" />
                <strong>+{state.auxiliaryFanfare.coinsAwarded}{tr("CoinPurchase.COINS_SUFFIX")}</strong>
                <span>{state.auxiliaryFanfare.totalCoins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</span>
              </div>
            ) : activeRewardStep?.kind === "achievement" ? (
              <AchievementFanfare achievementId={activeRewardStep.achievementId} />
            ) : null}
            <small className="sequence-progress">
              {rewardStepIndex + 1}/{Math.max(1, auxiliarySteps.length)}
            </small>
            <button className="play-primary" onClick={advanceRewardFanfare}>
              {rewardStepIndex + 1 < auxiliarySteps.length
                ? tr("GameScreenAlerts.NEXT_BUTTON")
                : tr("CoinPurchase.AWESOME_BUTTON")}
            </button>
          </div>
        )}

        <GameModalPages
          state={state}
          onClose={onClose}
          onContinue={onContinue}
          onPurchase={onPurchase}
          onOpenModal={onOpenModal}
          onToggleMute={onToggleMute}
          onRequestHint={onRequestHint}
          onRequestSkip={onRequestSkip}
          onRequestLeaderboard={onRequestLeaderboard}
          onUpdateUsername={onUpdateUsername}
          onUpdateAvatar={onUpdateAvatar}
        />
      </section>
    </div>
  );
}

function AchievementFanfare({achievementId}: {achievementId: string}) {
  const achievement = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === achievementId);
  return (
    <div className="achievement-unlock">
      <span className="achievement-icon large" aria-hidden="true">{achievement?.icon ?? "🏆"}</span>
      <strong>{achievement?.name ?? achievementId}</strong>
      {achievement?.description && <p>{achievement.description}</p>}
    </div>
  );
}
