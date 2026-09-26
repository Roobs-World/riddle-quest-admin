import {useEffect, useRef, useState} from "react";
import "../styles.modal-shell.css";
import "../styles.modal-rewards.css";
import "../styles.modal-commerce.css";
import "../styles.account.css";
import type {GameModal, GameSessionState} from "./gameSession";
import {tr} from "./i18n";
import {SpinningWheel} from "./SpinningWheelLoader";
import {GameModalPages} from "./GameModalPages";
import {RewardFanfareContent, VictoryFanfareContent} from "./modalPages/fanfare/FanfareModalContent";
import {
  createRewardFanfareSteps,
  createVictoryFanfareSteps,
  getActiveCoinAward,
  getActiveFanfareStep,
  isCoinCollectionPending,
} from "./modalPages/fanfare/fanfareSequence";

/** Event handlers and state required by the game modal shell. */
export type GameModalViewProps = {
  /** Stores state. */
  state: GameSessionState;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
  /** Stores on next. */
  onNext: () => void;
  /** The synchronizing used by the current operation. */
  synchronizing?: boolean;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
  /** Stores presence enabled. */
  presenceEnabled?: boolean;
  /** Stores on toggle presence. */
  onTogglePresence?: () => void;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
  /** Stores on request hint. */
  onRequestHint: () => void;
  /** Stores on request skip. */
  onRequestSkip: () => void;
  /** Stores on request leaderboard. */
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak") => void;
  /** Stores on update username. */
  onUpdateUsername: (username: string) => void;
  /** Stores on update avatar. */
  onUpdateAvatar: (file: File) => Promise<void>;
  /** Stores on delete account. */
  onDeleteAccount: () => void;
  /** Stores on coin balance preview. */
  onCoinBalancePreview: (balance: number | null) => void;
};

/** Coordinates the accessible modal shell and delegates modal-specific content. */
export function GameModalView({
  state,
  onClose,
  onContinue,
  onPurchase,
  onNext,
  synchronizing = false,
  onOpenModal,
  onToggleMute,
  presenceEnabled,
  onTogglePresence,
  commerceAvailable = true,
  onRequestHint,
  onRequestSkip,
  onRequestLeaderboard,
  onUpdateUsername,
  onUpdateAvatar,
  onDeleteAccount,
  onCoinBalancePreview,
}: GameModalViewProps) {
  /** Provides [victory step index, set victory step index] behavior. */
  const [victoryStepIndex, setVictoryStepIndex] = useState(0);
  /** Provides [reward step index, set reward step index] behavior. */
  const [rewardStepIndex, setRewardStepIndex] = useState(0);
  /** Provides [collected coin step, set collected coin step] behavior. */
  const [collectedCoinStep, setCollectedCoinStep] = useState<string | null>(null);
  /** Provides modal ref behavior. */
  const modalRef = useRef<HTMLElement | null>(null);
  /** Provides on close ref behavior. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!state.modal) {
      return;
    }
    /** Provides previously focused behavior. */
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /** Provides modal behavior. */
    const modal = modalRef.current;
    modal?.scrollTo({top: 0, left: 0});
    modal?.parentElement?.scrollTo({top: 0, left: 0});
    /** Provides external notice behavior. */
    const externalNotice = document.querySelector<HTMLElement>(".play-alert");
    if (externalNotice) {
      externalNotice.inert = true;
      externalNotice.setAttribute("aria-hidden", "true");
    }
    /** Gets focusable. */
    const getFocusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    window.requestAnimationFrame(() => getFocusable()[0]?.focus());
    /** Handles key down. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        /** Provides collecting coins behavior. */
        const collectingCoins = modal?.querySelector("[data-coin-collection='pending']");
        if (state.modal !== "victory" && !(state.modal === "continue" && state.guessPending) && !collectingCoins) {
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      /** Provides focusable behavior. */
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      /** Provides first behavior. */
      const first = focusable[0];
      /** Provides last behavior. */
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
  }, [state.guessPending, state.lastRewards, state.modal]);

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

  /** Provides victory steps behavior. */
  const victorySteps = createVictoryFanfareSteps(state.lastRewards);
  /** Provides auxiliary steps behavior. */
  const auxiliarySteps = createRewardFanfareSteps(state.auxiliaryFanfare);
  /** Provides active victory step behavior. */
  const activeVictoryStep = getActiveFanfareStep(victorySteps, victoryStepIndex);
  /** Provides active reward step behavior. */
  const activeRewardStep = getActiveFanfareStep(auxiliarySteps, rewardStepIndex);
  /** Provides active coin award behavior. */
  const activeCoinAward = getActiveCoinAward(state, activeVictoryStep, activeRewardStep);
  /** Provides coin collection pending behavior. */
  const coinCollectionPending = isCoinCollectionPending(activeCoinAward, collectedCoinStep);
  /** Provides titles behavior. */
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
  /** Provides active fanfare step behavior. */
  const activeFanfareStep = state.modal === "victory" ? activeVictoryStep : activeRewardStep;
  if (activeFanfareStep?.kind === "achievement") {
    titles[state.modal] = tr("Achievements.FANFARE_TITLE");
  } else if (activeFanfareStep?.kind === "level") {
    titles.victory = tr("LevelUpFanfare.TITLE");
  } else if (activeFanfareStep?.kind === "rank") {
    titles.victory = tr("RankUpFanfare.TITLE");
  } else if (activeFanfareStep?.kind === "referral") {
    titles.reward = tr("VictoryModal.REFERRAL_REWARD_TITLE");
  }

  /** Indicates whether is mandatory outcome. */
  const isMandatoryOutcome = state.modal === "victory" || coinCollectionPending ||
    (state.modal === "continue" && state.guessPending);
  /** Provides advance victory fanfare behavior. */
  const advanceVictoryFanfare = () => {
    if (victoryStepIndex + 1 < victorySteps.length) {
      setVictoryStepIndex((index) => index + 1);
      return;
    }
    onClose();
    window.dispatchEvent(new CustomEvent("riddle-quest:victory-dismissed"));
    onNext();
  };
  /** Provides advance reward fanfare behavior. */
  const advanceRewardFanfare = () => {
    if (rewardStepIndex + 1 < auxiliarySteps.length) {
      setRewardStepIndex((index) => index + 1);
      return;
    }
    onClose();
  };

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={isMandatoryOutcome ? undefined : onClose}>
      {state.modal !== "profile" && state.modal !== "continue" ? <SpinningWheel /> : null}
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
          <VictoryFanfareContent
            synchronizing={synchronizing}
            activeCoinAward={activeCoinAward}
            activeStep={activeVictoryStep}
            coinCollectionPending={coinCollectionPending}
            onAdvance={advanceVictoryFanfare}
            onBalancePreview={onCoinBalancePreview}
            onCoinCollected={() => setCollectedCoinStep(activeCoinAward?.id ?? null)}
            state={state}
            stepCount={victorySteps.length}
            stepIndex={victoryStepIndex}
          />
        )}

        {state.modal === "reward" && state.auxiliaryFanfare && (
          <RewardFanfareContent
            activeCoinAward={activeCoinAward}
            activeStep={activeRewardStep}
            coinCollectionPending={coinCollectionPending}
            onAdvance={advanceRewardFanfare}
            onBalancePreview={onCoinBalancePreview}
            onCoinCollected={() => setCollectedCoinStep(activeCoinAward?.id ?? null)}
            stepCount={auxiliarySteps.length}
            stepIndex={rewardStepIndex}
          />
        )}

        <GameModalPages
          state={state}
          onClose={onClose}
          onContinue={onContinue}
          onPurchase={onPurchase}
          onOpenModal={onOpenModal}
          onToggleMute={onToggleMute}
          presenceEnabled={presenceEnabled}
          onTogglePresence={onTogglePresence}
          commerceAvailable={commerceAvailable}
          onRequestHint={onRequestHint}
          onRequestSkip={onRequestSkip}
          onRequestLeaderboard={onRequestLeaderboard}
          onUpdateUsername={onUpdateUsername}
          onUpdateAvatar={onUpdateAvatar}
          onDeleteAccount={onDeleteAccount}
        />
      </section>
    </div>
  );
}
