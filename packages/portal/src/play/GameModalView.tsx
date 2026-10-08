import {completionPresentationKey} from "./completionPresentation";
import {getConfirmedRiddleWin} from "./ConfirmedRiddleOutcome";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import "../styles.modal-shell.css";
import "../styles.modal-rewards.css";
import "../styles.modal-commerce.css";
import "../styles.account.css";
import "../styles.profile-details.css";
import type {GameModal, GameSessionState} from "./gameSession";
import {useTranslator} from "./i18n";
import {SpinningWheel} from "./SpinningWheelLoader";
import {GameModalPages} from "./GameModalPages";
import {RewardFanfareContent, VictoryFanfareContent} from "./modalPages/fanfare/FanfareModalContent";
import {
  createRewardFanfareSteps,
  createVictoryFanfareSteps,
  getActiveCoinAward,
  getActiveFanfareStep,
} from "./modalPages/fanfare/fanfareSequence";
/** A nested confirmation owns focus ahead of its containing modal. */
const getModalFocusScope = (modal: HTMLElement | null): HTMLElement | null =>
  modal?.querySelector<HTMLElement>("[role=alertdialog]") ?? modal;

/** Enabled controls belong to the committed confirmation or modal scope. */
const getModalFocusable = (scope: HTMLElement | null): HTMLElement[] =>
  Array.from(
    scope?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ) ?? [],
  );

/** Event handlers and state required by the game modal shell. */
export type GameModalViewProps = {
  /** Stores state. */
  state: GameSessionState;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
  /** Optional target-funded continuation and its exclusive operation lock. */
  onRecoverAttempt?: () => void;
  /** Disables competing loss actions while continuation is awaiting completion. */
  continuationPending?: boolean;
  /** Suspends modal focus and keyboard ownership while its parent is inert. */
  interactionBlocked?: boolean;
  /** Stores on purchase. */
  onPurchase: (productId: string) => void;
  /** Stores on next. */
  onNext: () => void;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
  /** Gates paid-action presentation independently of provider checkout availability. */
  economyAvailable?: boolean;
  /** Stores on request hint. */
  onRequestHint: () => void;
  /** Stores on request skip. */
  onRequestSkip: () => void;
  /** Stores on request leaderboard. */
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak" | "multiplayerWins") => void;
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
  onRecoverAttempt,
  continuationPending = false,
  interactionBlocked = false,
  onPurchase,
  onNext,
  onOpenModal,
  onToggleMute,
  commerceAvailable = true,
  economyAvailable = true,
  onRequestHint,
  onRequestSkip,
  onRequestLeaderboard,
  onUpdateUsername,
  onUpdateAvatar,
  onDeleteAccount,
  onCoinBalancePreview,
}: GameModalViewProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Provides [victory step index, set victory step index] behavior. */
  const [victoryStepIndex, setVictoryStepIndex] = useState(0);
  /** Provides [reward step index, set reward step index] behavior. */
  const [rewardStepIndex, setRewardStepIndex] = useState(0);
  /** Provides modal ref behavior. */
  const modalRef = useRef<HTMLElement | null>(null);
  /** Last native focus can resume after another surface temporarily covers this modal. */
  const lastFocusedControlRef = useRef<HTMLElement | null>(null);
  /** Native keys follow the visible modal callback, readiness and interaction owner. */
  const keyboardRef = useRef({onClose, modal: state.modal, guessPending: state.guessPending, continuationPending, interactionBlocked});
  useLayoutEffect(() => {
    keyboardRef.current = {onClose, modal: state.modal, guessPending: state.guessPending, continuationPending, interactionBlocked};
    if (!state.modal) lastFocusedControlRef.current = null;
  }, [onClose, state.modal, state.guessPending, continuationPending, interactionBlocked]);

  /** A page switch remains part of the same modal interaction. */
  const modalOpen = state.modal !== null;
  useEffect(() => {
    if (!modalOpen) return;
    // Remember the gameplay trigger once. A Settings/Profile child button may
    // disappear when its next modal page renders and cannot receive focus back.
    /** Original game control remains the focus return target across modal page changes. */
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (trigger?.isConnected && !trigger.matches(":disabled, [aria-disabled='true']")) {
        trigger.focus({preventScroll: true});
      }
    };
  }, [modalOpen]);

  useLayoutEffect(() => {
    if (!modalOpen || interactionBlocked) return;
    /** Native keyboard ownership starts and retires with the committed visible surface. */
    let listening = true;
    /** Active dialog keys yield to composing editors and earlier event owners. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      /** Only the committed modal policy may authorize native dismissal. */
      const policy = keyboardRef.current;
      /** Page switches retain the listener while their current DOM owns focus. */
      const modal = modalRef.current;
      if (!listening || !policy.modal || policy.interactionBlocked || !modal?.isConnected || modal.closest("[inert]") || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (policy.modal !== "victory" && !(policy.modal === "continue" && (policy.guessPending || policy.continuationPending))) {
          policy.onClose();
        }
        return;
      }
      /** The nested confirmation or outer modal owns the current Tab sequence. */
      const activeDialog = getModalFocusScope(modal);
      /** Enabled native controls in that committed scope define the loop. */
      const focusable = getModalFocusable(activeDialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      /** Provides first behavior. */
      const first = focusable[0];
      /** Provides last behavior. */
      const last = focusable[focusable.length - 1];
      /** Focus outside the active scope enters at the requested Tab endpoint. */
      if (!activeDialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      listening = false;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen, interactionBlocked]);

  useEffect(() => {
    if (!state.modal) return;
    /** Only entering a different page resets the shell's reading position. */
    const modal = modalRef.current;
    modal?.scrollTo({top: 0, left: 0});
    modal?.parentElement?.scrollTo({top: 0, left: 0});
  }, [state.modal]);

  useEffect(() => {
    if (!state.modal || interactionBlocked) {
      return;
    }
    /** Provides modal behavior. */
    const modal = modalRef.current;
    /** Provides external notice behavior. */
    const externalNotice = document.querySelector<HTMLElement>(".play-alert");
    if (externalNotice) {
      externalNotice.inert = true;
      externalNotice.setAttribute("aria-hidden", "true");
    }
    /** Deferred focus waits for the active modal page's controls to mount. */
    const focusFrame = window.requestAnimationFrame(() => {
      if (modal !== modalRef.current || !modal?.isConnected || modal.closest("[inert]") || keyboardRef.current.interactionBlocked || !keyboardRef.current.modal) return;
      /** Autofocus and player-selected controls retain their native focus and caret. */
      const focusable = getModalFocusable(getModalFocusScope(modal));
      if (focusable.some((control) => control === document.activeElement)) return;
      /** A removed, disabled or previous-page control cannot reclaim the current scope. */
      const previous = lastFocusedControlRef.current;
      if (previous && focusable.includes(previous)) {
        previous.focus({preventScroll: true});
      } else {
        focusable[0]?.focus();
      }
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (externalNotice) {
        externalNotice.inert = false;
        externalNotice.removeAttribute("aria-hidden");
      }
    };
  }, [state.guessPending, state.lastRewards, state.modal, continuationPending, interactionBlocked]);

  useEffect(() => {
    setVictoryStepIndex(0);
  }, [state.lastOutcome?.id]);

  useEffect(() => {
    setRewardStepIndex(0);
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
  const isMandatoryOutcome =
    state.modal === "victory" || (state.modal === "continue" && (state.guessPending || continuationPending));
  /** Provides advance victory fanfare behavior. */
  const advanceVictoryFanfare = () => {
    if (victoryStepIndex + 1 < victorySteps.length) {
      setVictoryStepIndex((index) => index + 1);
      return;
    }
    if (!state.completionAcknowledged && state.riddle && getConfirmedRiddleWin(state.riddle)) return;
    onClose();
    window.dispatchEvent(
      new CustomEvent("riddle-quest:victory-dismissed", {
        detail: {
          outcomeKey: state.lastOutcome ? completionPresentationKey(state.lastOutcome) : null,
        },
      }),
    );
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
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement) lastFocusedControlRef.current = event.target;
        }}
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
            activeCoinAward={activeCoinAward}
            activeStep={activeVictoryStep}
            onAdvance={advanceVictoryFanfare}
            onBalancePreview={onCoinBalancePreview}
            state={state}
            stepCount={victorySteps.length}
            stepIndex={victoryStepIndex}
          />
        )}

        {state.modal === "reward" && state.auxiliaryFanfare && (
          <RewardFanfareContent
            activeCoinAward={activeCoinAward}
            activeStep={activeRewardStep}
            onAdvance={advanceRewardFanfare}
            onBalancePreview={onCoinBalancePreview}
            stepCount={auxiliarySteps.length}
            stepIndex={rewardStepIndex}
          />
        )}

        <GameModalPages
          state={state}
          onClose={onClose}
          onContinue={onContinue}
          onRecoverAttempt={onRecoverAttempt}
          continuationPending={continuationPending}
          onPurchase={onPurchase}
          onOpenModal={onOpenModal}
          onToggleMute={onToggleMute}
          commerceAvailable={commerceAvailable}
          economyAvailable={economyAvailable}
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
