import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from "react";
import {createPortal} from "react-dom";
import coinUrl from "../../../../assets/images/coin.svg";
import treasureChestClosedUrl from "../../../../assets/images-web/chest-closed.png";
import treasureChestUrl from "../../../../assets/images-web/chest-open.webp";
import {ACHIEVEMENT_DEFINITIONS} from "./achievements";
import type {GameModal, GameSessionState} from "./gameSession";
import {tr} from "./i18n";
import {getRankForLevel} from "./ranks";
import {RankIcon} from "./RankIcon";
import {SpinningWheel, SpinningWheelLoader} from "./SpinningWheelLoader";
import {GameModalPages} from "./GameModalPages";

type FanfareStep =
  | {kind: "achievement"; achievementId: string}
  | {kind: "victory"}
  | {kind: "level"}
  | {kind: "rank"}
  | {kind: "purchase"}
  | {kind: "coins"};

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
  onCoinBalancePreview,
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
  onCoinBalancePreview: (balance: number | null) => void;
}) {
  const [victoryStepIndex, setVictoryStepIndex] = useState(0);
  const [rewardStepIndex, setRewardStepIndex] = useState(0);
  const [collectedCoinStep, setCollectedCoinStep] = useState<string | null>(null);
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
        const collectingCoins = modal?.querySelector("[data-coin-collection='pending']");
        if (state.modal !== "victory" && !collectingCoins) {
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
    setCollectedCoinStep(null);
  }, [state.lastOutcome?.id]);

  useEffect(() => {
    setRewardStepIndex(0);
    setCollectedCoinStep(null);
  }, [state.auxiliaryFanfare?.id]);

  if (!state.modal) {
    return null;
  }

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
        ...(state.auxiliaryFanfare.kind === "achievement" && state.auxiliaryFanfare.coinsAwarded > 0
          ? ([{kind: "coins"}] as FanfareStep[])
          : []),
      ]
    : [];
  const activeVictoryStep = victorySteps[Math.min(victoryStepIndex, Math.max(0, victorySteps.length - 1))];
  const activeRewardStep = auxiliarySteps[Math.min(rewardStepIndex, Math.max(0, auxiliarySteps.length - 1))];
  const activeCoinAward = state.modal === "victory" && activeVictoryStep?.kind === "victory"
    ? {
        id: `victory-${state.lastOutcome?.id ?? "current"}`,
        amount: state.lastRewards?.coinsEarned ?? 0,
        total: state.lastRewards?.totalCoins ?? state.profile?.coins ?? 0,
      }
    : state.modal === "reward" && (activeRewardStep?.kind === "purchase" || activeRewardStep?.kind === "coins")
      ? {
          id: `${state.auxiliaryFanfare?.id ?? "reward"}-${activeRewardStep.kind}`,
          amount: state.auxiliaryFanfare?.coinsAwarded ?? 0,
          total: state.auxiliaryFanfare?.totalCoins ?? state.profile?.coins ?? 0,
        }
      : null;
  const coinCollectionPending = Boolean(
    activeCoinAward && activeCoinAward.amount > 0 && collectedCoinStep !== activeCoinAward.id,
  );
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

  const isMandatoryOutcome = state.modal === "victory" || coinCollectionPending;
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
                {activeCoinAward && activeCoinAward.amount > 0 ? (
                  <CoinAwardSequence
                    key={activeCoinAward.id}
                    amount={activeCoinAward.amount}
                    total={activeCoinAward.total}
                    onBalancePreview={onCoinBalancePreview}
                    onCollected={() => setCollectedCoinStep(activeCoinAward.id)}
                  />
                ) : null}
                <div className="reward-summary reward-details">
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
                <button className="play-primary reward-continue" disabled={coinCollectionPending} onClick={advanceVictoryFanfare}>
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
            {activeRewardStep?.kind === "purchase" || activeRewardStep?.kind === "coins" ? (
              activeCoinAward && activeCoinAward.amount > 0 ? (
                <CoinAwardSequence
                  key={activeCoinAward.id}
                  amount={activeCoinAward.amount}
                  total={activeCoinAward.total}
                  onBalancePreview={onCoinBalancePreview}
                  onCollected={() => setCollectedCoinStep(activeCoinAward.id)}
                />
              ) : null
            ) : activeRewardStep?.kind === "achievement" ? (
              <AchievementFanfare achievementId={activeRewardStep.achievementId} />
            ) : null}
            <small className="sequence-progress">
              {rewardStepIndex + 1}/{Math.max(1, auxiliarySteps.length)}
            </small>
            <button className="play-primary reward-continue" disabled={coinCollectionPending} onClick={advanceRewardFanfare}>
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
      <strong>{achievement ? (achievement.nameKey ? tr(achievement.nameKey) : achievement.name) : achievementId}</strong>
      {achievement && <p>{achievement.descriptionKey ? tr(achievement.descriptionKey) : achievement.description}</p>}
    </div>
  );
}

type CoinParticle = {
  id: number;
  startX: number;
  startY: number;
  travelX: number;
  travelY: number;
  burstX: number;
  burstY: number;
  delayMs: number;
  durationMs: number;
};

type CoinParticleStyle = CSSProperties & {
  "--coin-travel-x": string;
  "--coin-travel-y": string;
  "--coin-burst-x": string;
  "--coin-burst-y": string;
  "--coin-delay": string;
  "--coin-duration": string;
};

function CoinAwardSequence({amount, total, onBalancePreview, onCollected}: {
  amount: number;
  total: number;
  onBalancePreview: (balance: number | null) => void;
  onCollected: () => void;
}) {
  const [phase, setPhase] = useState<"waiting" | "collecting" | "collected">("waiting");
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const chestRef = useRef<HTMLButtonElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const safeAmount = Math.max(0, Math.round(amount));
  const finalBalance = Math.max(0, Math.round(total));
  const startingBalance = Math.max(0, finalBalance - safeAmount);

  useLayoutEffect(() => {
    onBalancePreview(startingBalance);
    return () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    };
  }, [onBalancePreview, startingBalance]);

  const collectCoins = () => {
    if (phase !== "waiting" || safeAmount <= 0) return;
    const chestRect = chestRef.current?.getBoundingClientRect();
    const meter = document.querySelector<HTMLElement>("[data-coin-meter]");
    const meterRect = meter?.getBoundingClientRect();
    if (!chestRect || !meter || !meterRect) {
      onBalancePreview(finalBalance);
      setPhase("collected");
      onCollected();
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particleCount = Math.min(12, Math.max(1, safeAmount));
    const baseValue = Math.floor(safeAmount / particleCount);
    const remainder = safeAmount % particleCount;
    const sourceX = chestRect.left + chestRect.width / 2;
    const sourceY = chestRect.top + chestRect.height * 0.42;
    const targetX = meterRect.left + meterRect.width * 0.72;
    const targetY = meterRect.top + meterRect.height / 2;
    const durationMs = reducedMotion ? 180 : 620;
    const delayStepMs = reducedMotion ? 35 : 95;
    const nextParticles = Array.from({length: particleCount}, (_, index): CoinParticle => {
      const angle = (-150 + (index * 300) / Math.max(1, particleCount - 1)) * (Math.PI / 180);
      const burstDistance = 36 + (index % 3) * 10;
      return {
        id: index,
        startX: sourceX,
        startY: sourceY,
        travelX: targetX - sourceX,
        travelY: targetY - sourceY,
        burstX: Math.cos(angle) * burstDistance,
        burstY: Math.sin(angle) * burstDistance - 24,
        delayMs: index * delayStepMs,
        durationMs,
      };
    });

    setPhase("collecting");
    setParticles(nextParticles);
    let displayedBalance = startingBalance;
    nextParticles.forEach((particle, index) => {
      const particleValue = baseValue + (index < remainder ? 1 : 0);
      const timer = window.setTimeout(() => {
        displayedBalance += particleValue;
        onBalancePreview(index === nextParticles.length - 1 ? finalBalance : displayedBalance);
        meter.animate(
          [
            {transform: "scale(1)"},
            {transform: "scale(1.24)"},
            {transform: "scale(0.94)"},
            {transform: "scale(1)"},
          ],
          {duration: reducedMotion ? 120 : 260, easing: "ease-out"},
        );
        if (index === nextParticles.length - 1) {
          setParticles([]);
          setPhase("collected");
          onCollected();
        }
      }, particle.delayMs + particle.durationMs);
      timersRef.current.push(timer);
    });
  };

  return (
    <div className="coin-award" data-coin-collection={phase === "collected" ? "complete" : "pending"}>
      <button
        ref={chestRef}
        type="button"
        className={`reward-chest ${phase}`}
        disabled={phase !== "waiting"}
        onClick={collectCoins}
        aria-label={tr("CoinPurchase.TAP_CHEST_TO_COLLECT")}
      >
        <img src={phase === "waiting" ? treasureChestClosedUrl : treasureChestUrl} alt="" />
      </button>
      <strong>+{safeAmount.toLocaleString()}{tr("CoinPurchase.COINS_SUFFIX")}</strong>
      <span aria-live="polite">
        {phase === "collected"
          ? `${finalBalance.toLocaleString()} ${tr("CoinShop.COINS_SUFFIX")}`
          : tr("CoinPurchase.TAP_CHEST_TO_COLLECT")}
      </span>
      {particles.length > 0 && createPortal(
        <div className="reward-coin-particles" aria-hidden="true">
          {particles.map((particle) => (
            <img
              key={particle.id}
              className="reward-coin-particle"
              src={coinUrl}
              alt=""
              style={{
                left: particle.startX,
                top: particle.startY,
                "--coin-travel-x": `${particle.travelX}px`,
                "--coin-travel-y": `${particle.travelY}px`,
                "--coin-burst-x": `${particle.burstX}px`,
                "--coin-burst-y": `${particle.burstY}px`,
                "--coin-delay": `${particle.delayMs}ms`,
                "--coin-duration": `${particle.durationMs}ms`,
              } as CoinParticleStyle}
            />
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
