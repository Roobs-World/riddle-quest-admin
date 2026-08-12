import {useEffect, useMemo, useRef, useState} from "react";
import {tr, useLocale} from "../i18n";
import type {GameModal, GameSessionState} from "../gameSession";
import {
  createGuidanceStorageKey,
  createTooltipTourStorageKey,
  getContextualTooltipCandidates,
  getGameTour,
  getOnboardingTotalSteps,
  PROFILE_TOUR,
  TOOLTIP_KEYS,
  TOOLTIP_SELECTORS,
  type TooltipId,
} from "./guidanceConfig";
import {OnboardingOverlay} from "./OnboardingOverlay";
import {TooltipOverlay} from "./TooltipOverlay";
import {
  completePlayerOnboarding,
  hasCompletedPlayerOnboarding,
  safeBrowserStorageGet,
  safeBrowserStorageSet,
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
};

/** Coordinates onboarding, feature tours, and contextual guidance tooltips. */
export function GuidanceOverlay({
  state,
  modal,
  onActiveChange,
  registrationName,
  registrationInviterName,
  interactionBlocked = false,
}: GuidanceOverlayProps) {
  useLocale();
  const userId = state.user?.uid;
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [welcomeOnly, setWelcomeOnly] = useState(false);
  const [sequence, setSequence] = useState<TooltipId[]>([]);
  const [sequenceName, setSequenceName] = useState<string | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const onboardingCardRef = useRef<HTMLDivElement | null>(null);
  const tooltipCardRef = useRef<HTMLElement | null>(null);
  const activeTooltip = sequence[sequenceIndex];
  const guidanceActive = onboardingStep !== null || Boolean(activeTooltip);

  useEffect(() => {
    if (!guidanceActive) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      window.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    };
  }, [guidanceActive]);

  useEffect(() => {
    if (!guidanceActive || interactionBlocked) return;
    const dialog = onboardingStep !== null ? onboardingCardRef.current : tooltipCardRef.current;
    if (!dialog) return;
    const getFocusable = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ),
    );
    const focusFrame = window.requestAnimationFrame(() => (getFocusable()[0] ?? dialog).focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
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
    if (onboardingStep !== 2) return;
    const closePrompt = () => {
      completePlayerOnboarding(createGuidanceStorageKey("onboarding", userId));
      setOnboardingStep(null);
    };
    window.addEventListener("riddle-quest:registration-prompt-closed", closePrompt);
    return () => window.removeEventListener("riddle-quest:registration-prompt-closed", closePrompt);
  }, [onboardingStep, userId]);

  useEffect(() => {
    if (onboardingStep !== 2 || state.user?.platformRegistered !== false) return;
    window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-opened"));
  }, [onboardingStep, state.user?.platformRegistered]);

  useEffect(() => {
    onActiveChange?.(guidanceActive);
    const modalElement = document.querySelector<HTMLElement>(".game-modal");
    if (modalElement && activeTooltip) {
      modalElement.inert = true;
      modalElement.setAttribute("aria-hidden", "true");
    }
    return () => {
      onActiveChange?.(false);
      if (modalElement) {
        modalElement.inert = false;
        modalElement.removeAttribute("aria-hidden");
      }
    };
  }, [activeTooltip, guidanceActive, onActiveChange, onboardingStep]);

  useEffect(() => {
    if (!state.riddle || onboardingStep !== null || sequence.length > 0) {
      return;
    }
    const hasCompletedOnboarding = hasCompletedPlayerOnboarding(
      createGuidanceStorageKey("onboarding", userId),
    );
    if (safeBrowserStorageGet("session", createGuidanceStorageKey("welcomeSession", userId)) !== "seen") {
      setWelcomeOnly(hasCompletedOnboarding);
      setOnboardingStep(0);
      return;
    }
    if (!hasCompletedOnboarding) {
      setWelcomeOnly(false);
      setOnboardingStep(0);
      return;
    }
    if (safeBrowserStorageGet("local", createTooltipTourStorageKey("gameTour", userId)) !== "seen") {
      setSequence(getGameTour(state.gameMode));
      setSequenceName("gameTour");
      setSequenceIndex(0);
    }
  }, [onboardingStep, sequence.length, state.gameMode, state.riddle, userId]);

  useEffect(() => {
    if (
      modal === "profile" &&
      onboardingStep === null &&
      sequence.length === 0 &&
      safeBrowserStorageGet("local", createTooltipTourStorageKey("profileTour", userId)) !== "seen"
    ) {
      const timer = window.setTimeout(() => {
        setSequence([...PROFILE_TOUR]);
        setSequenceName("profileTour");
        setSequenceIndex(0);
      }, 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [modal, onboardingStep, sequence.length, userId]);

  useEffect(() => {
    if (
      onboardingStep !== null ||
      sequence.length > 0 ||
      !hasCompletedPlayerOnboarding(createGuidanceStorageKey("onboarding", userId)) ||
      safeBrowserStorageGet("local", createTooltipTourStorageKey("gameTour", userId)) !== "seen"
    ) {
      return;
    }
    const candidates = getContextualTooltipCandidates(state, modal);
    const candidate = candidates.find(
      ({id, when}) =>
        when && safeBrowserStorageGet("local", createGuidanceStorageKey(`tooltipSeen:${id}`, userId)) !== "seen",
    );
    if (!candidate) {
      return;
    }
    setSequence([candidate.id]);
    setSequenceName(`contextual:${candidate.id}`);
    setSequenceIndex(0);
  }, [
    modal,
    onboardingStep,
    sequence.length,
    state.gameMode,
    state.guesses.length,
    state.lastOutcome,
    state.lastRewards,
    state.profile,
    userId,
  ]);

  useEffect(() => {
    if (!activeTooltip) {
      setTargetRect(null);
      return;
    }
    const updateRect = () => {
      const selector = TOOLTIP_SELECTORS[activeTooltip];
      const element = selector ? document.querySelector(selector) : null;
      if (!element) {
        setTargetRect(null);
        return;
      }
      element.scrollIntoView({block: "center", inline: "nearest", behavior: "auto"});
      window.requestAnimationFrame(() => {
        setTargetRect(element.getBoundingClientRect());
      });
    };
    const timer = window.setTimeout(updateRect, 80);
    window.addEventListener("resize", updateRect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
    };
  }, [activeTooltip]);

  const tooltipContent = useMemo(() => {
    if (!activeTooltip) {
      return null;
    }
    const [title, body] = TOOLTIP_KEYS[activeTooltip];
    return {title: tr(title), body: tr(body)};
  }, [activeTooltip]);

  const finishSequence = () => {
    if (sequenceName?.startsWith("contextual:")) {
      safeBrowserStorageSet(
        "local",
        createGuidanceStorageKey(`tooltipSeen:${sequenceName.slice("contextual:".length)}`, userId),
        "seen",
      );
    } else if (sequenceName) {
      safeBrowserStorageSet("local", createTooltipTourStorageKey(sequenceName, userId), "seen");
    }
    setSequence([]);
    setSequenceName(null);
    setSequenceIndex(0);
  };

  if (onboardingStep !== null) {
    const isWelcome = onboardingStep === 0;
    const totalSteps = getOnboardingTotalSteps(onboardingStep, state.user?.platformRegistered);
    return (
      <OnboardingOverlay
        cardRef={onboardingCardRef}
        onboardingStep={onboardingStep}
        registrationName={registrationName}
        registrationInviterName={registrationInviterName}
        totalSteps={totalSteps}
        welcomeOnly={welcomeOnly}
        onAdvance={() => {
          if (isWelcome) {
            safeBrowserStorageSet("session", createGuidanceStorageKey("welcomeSession", userId), "seen");
            if (welcomeOnly) {
              setOnboardingStep(null);
              return;
            }
            setOnboardingStep(1);
            return;
          }
          if (totalSteps === 3) {
            setOnboardingStep(2);
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
        if (sequenceIndex + 1 >= sequence.length) {
          finishSequence();
        } else {
          setSequenceIndex((index) => index + 1);
        }
      }}
    />
  );
}
