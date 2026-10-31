import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {tr, useLocale} from "../i18n";
import type {GameModal, GameSessionState} from "../gameSession";
import {
  createGuidanceStorageKey,
  createTooltipTourStorageKey,
  getContextualTooltipCandidates,
  getGameTour,
  getOnboardingTotalSteps,
  getProfileTour,
  hasSeenContextualTooltip,
  hasSeenTooltipTour,
  TOOLTIP_KEYS,
  TOOLTIP_SELECTORS,
  type TooltipId,
} from "./guidanceConfig";
import {OnboardingOverlay} from "./OnboardingOverlay";
import {TooltipOverlay} from "./TooltipOverlay";
import {completionPresentationKey} from "../completionPresentation";
import {GuidanceSeenMarkers} from "./GuidanceSeenMarkers";
import {
  completePlayerOnboarding,
  hasCompletedPlayerOnboarding,
} from "../playerPreferences";

export {getOnboardingTotalSteps} from "./guidanceConfig";
/** State and optional callbacks required by the guidance coordinator. */
export type GuidanceOverlayProps = {
  /** Stores state. */
  state: GameSessionState;
  /** Stores modal. */
  modal: GameModal;
  /** Stores on active change. */
  onActiveChange?: (active: boolean) => void;
  /** Stores registration name. */
  registrationName?: string;
  /** Stores registration inviter name. */
  registrationInviterName?: string;
  /** Prevents an obscured guidance surface from taking or handling focus. */
  interactionBlocked?: boolean;
  /** Preserves pending guidance while multiplayer owns presentation and focus. */
  suspended?: boolean;
  /** Guidance must not advertise coin actions absent from the host's economy capability. */
  economyAvailable?: boolean;
  /** Matches whether the header renders its coin-shop control. */
  commerceAvailable?: boolean;
  /** Matches whether the game renders its multiplayer control. */
  multiplayerAvailable?: boolean;
};
/** Coordinates onboarding, feature tours, and contextual guidance tooltips. */
export function GuidanceOverlay({state, modal, onActiveChange, interactionBlocked = false, suspended = false, economyAvailable = true, commerceAvailable = state.products.length > 0, multiplayerAvailable = false}: GuidanceOverlayProps) {
  /** Committed catalog identity refreshes the active translated tooltip. */
  const locale = useLocale();
  /** Provides r id. */
  const userId = state.user?.uid;
  /** Earned progression unlocks coin-shop guidance after the player has tried a full round. */
  const hasWon = (state.profile?.totalWins ?? state.profile?.wins ?? 0) > 0;
  /** Completion releases this view even when browser storage rejects its marker; accounts have separate owners. */
  const seenMarkers = useMemo(() => new GuidanceSeenMarkers(), [userId]);
  /** Provides [onboarding step, set onboarding step] behavior. */
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  /** Provides [welcome only, set welcome only] behavior. */
  const [welcomeOnly, setWelcomeOnly] = useState(false);
  /** Provides [sequence, set sequence] behavior. */
  const [sequence, setSequence] = useState<TooltipId[]>([]);
  /** Provides [sequence name, set sequence name] behavior. */
  const [sequenceName, setSequenceName] = useState<string | null>(null);
  /** Provides [sequence index, set sequence index] behavior. */
  const [sequenceIndex, setSequenceIndex] = useState(0);
  /** Provides [target rect, set target rect] behavior. */
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  /** Provides [completion popups pending, set completion popups pending] behavior. */
  const [completionPopupsPending, setCompletionPopupsPending] = useState<string | null>(null);
  /** Provides onboarding card ref behavior. */
  const onboardingCardRef = useRef<HTMLDivElement | null>(null);
  /** Provides tooltip card ref behavior. */
  const tooltipCardRef = useRef<HTMLElement | null>(null);
  /** Provides active tooltip behavior. */
  const activeTooltip = sequenceName === "profileTour" && modal !== "profile" ? undefined : sequence[sequenceIndex];
  /** Provides guidance active behavior. */
  const guidanceActive = !suspended && (onboardingStep !== null || Boolean(activeTooltip));

  /** Explicit dismissal captures committed winning context before fast successor delivery clears it. */
  const committedStateRef = useRef(state);
  useLayoutEffect(() => {committedStateRef.current = state;}, [state]);

  useEffect(() => {
    if (modal === "victory" && (state.lastRewards?.newlyUnlockedAchievementIds.length ?? 0) > 0) {
      seenMarkers.markSeen("local", createGuidanceStorageKey("tooltipSeen:achievementEarned", userId));
    }
  }, [modal, seenMarkers, state.lastRewards, userId]);

  useEffect(() => {
    /** Provides on victory dismissed behavior. */
    const onVictoryDismissed = (event: Event) => {
      /** Provides key behavior. */
      const key: unknown = (
        event as CustomEvent<{
          /** Stores outcome key. */
          outcomeKey?: unknown;
        }>
      ).detail?.outcomeKey;
      /** Only the currently displayed account's winning outcome may release its guidance. */
      const current = committedStateRef.current;
      if (typeof key !== "string" || current.lastOutcome?.kind !== "win" ||
        completionPresentationKey(current.lastOutcome) !== key) return;
      // A reward may arrive after the player leaves the fanfare. Do not let its
      // achievement guidance interrupt the next riddle.
      seenMarkers.markSeen("local", createGuidanceStorageKey("tooltipSeen:achievementEarned", userId));
      setCompletionPopupsPending(key);
      // A ready successor can arrive in the same render as dismissal. Preserve the
      // winning milestone explicitly instead of relying on an intermediate board.
      if (onboardingStep !== null || sequence.length > 0 ||
        !hasCompletedPlayerOnboarding(createGuidanceStorageKey("onboarding", userId)) ||
        !hasSeenTooltipTour(seenMarkers, "gameTour", userId)) return;
      /** Dismissal makes the winning context eligible without changing its saved progress. */
      const candidate = getContextualTooltipCandidates(current, null, economyAvailable).find(({id, when}) =>
        when && !hasSeenContextualTooltip(seenMarkers, id, userId));
      if (candidate) {
        setSequence([candidate.id]);
        setSequenceName(`contextual:${candidate.id}`);
        setSequenceIndex(0);
      }
    };
    window.addEventListener("riddle-quest:victory-dismissed", onVictoryDismissed);
    return () => window.removeEventListener("riddle-quest:victory-dismissed", onVictoryDismissed);
  }, [economyAvailable, onboardingStep, seenMarkers, sequence.length, userId]);

  useEffect(() => {
    if (sequenceName !== "profileTour" || modal === "profile") return;
    // An interrupted tour remains unseen so reopening the profile can restart it.
    setSequence([]);
    setSequenceName(null);
    setSequenceIndex(0);
  }, [modal, sequenceName]);

  useEffect(() => {
    if (!guidanceActive) return;
    /** Provides previously focused behavior. */
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      window.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus({preventScroll: true});
      });
    };
  }, [guidanceActive]);

  useEffect(() => {
    if (!guidanceActive || interactionBlocked) return;
    /** Provides dialog behavior. */
    const dialog = onboardingStep !== null ? onboardingCardRef.current : tooltipCardRef.current;
    if (!dialog) return;
    /** Gets focusable. */
    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
    /** Provides focus frame behavior. */
    const focusFrame = window.requestAnimationFrame(() => (getFocusable()[0] ?? dialog).focus({preventScroll: true}));
    /** Handles key down. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== "Tab") return;
      /** Provides focusable behavior. */
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({preventScroll: true});
        return;
      }
      /** Provides first behavior. */
      const first = focusable[0];
      /** Provides last behavior. */
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({preventScroll: true});
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({preventScroll: true});
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({preventScroll: true});
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeTooltip, guidanceActive, interactionBlocked, onboardingStep]);

  useEffect(() => {
    onboardingCardRef.current?.scrollTo({top: 0});
  }, [onboardingStep]);

  useEffect(() => {
    onActiveChange?.(guidanceActive);
    /** Provides modal element behavior. */
    const modalElement = document.querySelector<HTMLElement>(".game-modal");
    if (modalElement && activeTooltip) {
      modalElement.setAttribute("aria-hidden", "true");
    }
    return () => {
      onActiveChange?.(false);
      if (modalElement) {
        modalElement.removeAttribute("aria-hidden");
      }
    };
  }, [activeTooltip, guidanceActive, onActiveChange, onboardingStep]);

  useEffect(() => {
    if (!state.riddle || onboardingStep !== null || sequence.length > 0) {
      return;
    }
    /** Indicates whether has completed onboarding. */
    const hasCompletedOnboarding = hasCompletedPlayerOnboarding(createGuidanceStorageKey("onboarding", userId));
    if (!seenMarkers.hasSeen("session", createGuidanceStorageKey("welcomeSession", userId))) {
      setWelcomeOnly(hasCompletedOnboarding);
      setOnboardingStep(0);
      return;
    }
    if (!hasCompletedOnboarding) {
      setWelcomeOnly(false);
      setOnboardingStep(0);
      return;
    }
    if (!hasSeenTooltipTour(seenMarkers, "gameTour", userId)) {
      setSequence(getGameTour(state.gameMode, commerceAvailable, economyAvailable, multiplayerAvailable, hasWon));
      setSequenceName("gameTour");
      setSequenceIndex(0);
    }
  }, [commerceAvailable, economyAvailable, hasWon, multiplayerAvailable, onboardingStep, seenMarkers, sequence.length, state.gameMode, state.riddle, userId]);

  useEffect(() => {
    if (
      modal === "profile" &&
      onboardingStep === null &&
      sequence.length === 0 &&
      !seenMarkers.hasSeen("local", createTooltipTourStorageKey("profileTour", userId))
    ) {
      /** Provides timer behavior. */
      const timer = window.setTimeout(() => {
        setSequence(getProfileTour(commerceAvailable));
        setSequenceName("profileTour");
        setSequenceIndex(0);
      }, 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [commerceAvailable, modal, onboardingStep, seenMarkers, sequence.length, userId]);

  useEffect(() => {
    if (
      onboardingStep !== null ||
      sequence.length > 0 ||
      !hasCompletedPlayerOnboarding(createGuidanceStorageKey("onboarding", userId)) ||
      !hasSeenTooltipTour(seenMarkers, "gameTour", userId)
    ) {
      return;
    }
    /** Provides candidates behavior. */
    const candidates = getContextualTooltipCandidates(state, modal, economyAvailable);
    /** Provides candidate behavior. */
    const candidate = candidates.find(
      ({id, when}) =>
        // The start-of-riddle coin tip waits behind a blocking prompt such as post-win registration.
        when && !(id === "gameCoins" && interactionBlocked) && !hasSeenContextualTooltip(seenMarkers, id, userId),
    );
    if (!candidate) {
      return;
    }
    setSequence([candidate.id]);
    setSequenceName(`contextual:${candidate.id}`);
    setSequenceIndex(0);
  }, [
    modal,
    economyAvailable,
    interactionBlocked,
    onboardingStep,
    sequence.length,
    seenMarkers,
    state.gameMode,
    state.guesses.length,
    state.lastOutcome,
    state.lastRewards,
    state.products,
    state.profile,
    state.riddle,
    userId,
  ]);

  useEffect(() => {
    if (!completionPopupsPending || modal !== null || onboardingStep !== null || sequence.length > 0) return;
    /** Provides contextual guidance ready behavior. */
    const contextualGuidanceReady =
      hasCompletedPlayerOnboarding(createGuidanceStorageKey("onboarding", userId)) &&
      hasSeenTooltipTour(seenMarkers, "gameTour", userId);
    /** Indicates whether has pending tooltip. */
    const hasPendingTooltip =
      contextualGuidanceReady &&
      getContextualTooltipCandidates(state, modal, economyAvailable).some(
        // The coin tip belongs to the next riddle's start, not the completion sequence it would otherwise delay.
        ({id, when}) =>
          when && id !== "gameCoins" && !hasSeenContextualTooltip(seenMarkers, id, userId),
      );
    if (!hasPendingTooltip) {
      setCompletionPopupsPending(null);
      window.dispatchEvent(
        new CustomEvent("riddle-quest:completion-popups-dismissed", {detail: {outcomeKey: completionPopupsPending}}),
      );
    }
  }, [
    completionPopupsPending,
    seenMarkers,
    modal,
    economyAvailable,
    onboardingStep,
    sequence.length,
    state.gameMode,
    state.lastOutcome,
    state.lastRewards,
    state.products,
    state.profile,
    state.riddle,
    userId,
  ]);

  useLayoutEffect(() => {
    /** Centered tooltips have no target geometry to maintain. */
    const selector = activeTooltip ? TOOLTIP_SELECTORS[activeTooltip] : undefined;
    if (!activeTooltip || suspended || !selector) {
      setTargetRect(null);
      return;
    }
    /** Updates rect. */
    const updateRect = () => {
      /** Provides element behavior. */
      const element = document.querySelector(selector);
      if (!element) {
        setTargetRect(null);
        return;
      }
      if (activeTooltip.startsWith("profile")) {
        /** Scrollable profile area containing the highlighted element. */
        const scrollContainer = element.closest(".profile-page");
        if (scrollContainer) {
          /** Highlighted element bounds. */
          const target = element.getBoundingClientRect();
          /** Visible profile bounds. */
          const visibleArea = scrollContainer.getBoundingClientRect();
          if (target.top < visibleArea.top || target.bottom > visibleArea.bottom) {
            element.scrollIntoView({block: "center", inline: "nearest", behavior: "instant"});
          }
        }
      }
      setTargetRect(element.getBoundingClientRect());
    };
    // Measure before paint so the button cannot jump after a player starts a tap.
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeTooltip, locale, suspended]);
  /** Provides tooltip content behavior. */
  const tooltipContent = useMemo(() => {
    if (!activeTooltip) {
      return null;
    }
    /** Provides [title, body] behavior. */
    if (activeTooltip === "gameSkip" && state.gameMode === "challenge") {
      return {title: tr("GameScreenAlerts.DAILY_SKIP_MODAL_TITLE"), body: tr("GameScreenAlerts.DAILY_SKIP_MESSAGE")};
    }
    /** Translated title and body keys for the selected contextual tooltip. */
    const [title, body] = TOOLTIP_KEYS[activeTooltip];
    return {title: tr(title), body: tr(body)};
  }, [activeTooltip, locale, state.gameMode]);
  /** Provides finish sequence behavior. */
  const finishSequence = () => {
    if (sequenceName?.startsWith("contextual:")) {
      seenMarkers.markSeen(
        "local",
        createGuidanceStorageKey(`tooltipSeen:${sequenceName.slice("contextual:".length)}`, userId),
      );
    } else if (sequenceName) {
      seenMarkers.markSeen("local", createTooltipTourStorageKey(sequenceName, userId));
    }
    setSequence([]);
    setSequenceName(null);
    setSequenceIndex(0);
  };

  if (suspended) return null;

  if (onboardingStep !== null) {
    /** Indicates whether is welcome. */
    const isWelcome = onboardingStep === 0;
    /** Provides total steps behavior. */
    const totalSteps = getOnboardingTotalSteps();
    return (
      <OnboardingOverlay
        cardRef={onboardingCardRef}
        onboardingStep={onboardingStep}
        totalSteps={totalSteps}
        welcomeOnly={welcomeOnly}
        onAdvance={() => {
          if (isWelcome) {
            seenMarkers.markSeen("session", createGuidanceStorageKey("welcomeSession", userId));
            if (welcomeOnly) {
              setOnboardingStep(null);
              return;
            }
            setOnboardingStep(1);
            return;
          }
          completePlayerOnboarding(createGuidanceStorageKey("onboarding", userId));
          setOnboardingStep(null);
        }}
      />
    );
  }

  if (!activeTooltip || !tooltipContent) {
    return null;
  }

  return (
    <TooltipOverlay
      cardRef={tooltipCardRef}
      activeTooltip={activeTooltip}
      content={tooltipContent}
      sequenceIndex={sequenceIndex}
      sequenceLength={sequence.length}
      targetRect={targetRect}
      onAdvance={() => {
        seenMarkers.markSeen("local", createGuidanceStorageKey(`tooltipSeen:${activeTooltip}`, userId));
        if (sequenceIndex + 1 >= sequence.length) {
          finishSequence();
        } else {
          setSequenceIndex((index) => index + 1);
        }
      }}
    />
  );
}
