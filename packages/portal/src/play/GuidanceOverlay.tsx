import {useEffect, useMemo, useRef, useState} from "react";
import logoUrl from "../../../../assets/images/main-logo.webp";
import {SpinningWheel} from "./SpinningWheelLoader";
import {tr, useLocale} from "./i18n";
import type {GameModal, GameSessionState} from "./gameSession";

type TooltipId =
  | "submitAnswer"
  | "gameCoins"
  | "gameHint"
  | "gameSkip"
  | "hintAfterWrongGuess"
  | "shopOutOfCoins"
  | "achievementEarned"
  | "leaderboardFifthCorrectAnswer"
  | "classicFromDaily"
  | "profileProgression"
  | "profileIdentity"
  | "profileDailyPuzzles"
  | "profileStats"
  | "profileCoins"
  | "profileAchievements"
  | "profileStatistics"
  | "profileLeaderboard";

const GAME_TOUR: TooltipId[] = ["gameCoins", "gameHint", "submitAnswer", "gameSkip"];
const PROFILE_TOUR: TooltipId[] = [
  "profileIdentity",
  "profileProgression",
  "profileDailyPuzzles",
  "profileStats",
  "profileCoins",
  "profileAchievements",
  "profileStatistics",
  "profileLeaderboard",
];

const tooltipKeys: Record<TooltipId, [string, string]> = {
  submitAnswer: ["Tooltips.SUBMIT_ANSWER_TITLE", "Tooltips.SUBMIT_ANSWER_BODY"],
  gameCoins: ["Tooltips.GAME_COINS_TITLE", "Tooltips.GAME_COINS_BODY"],
  gameHint: ["Tooltips.GAME_HINT_TITLE", "Tooltips.GAME_HINT_BODY"],
  gameSkip: ["Tooltips.GAME_SKIP_TITLE", "Tooltips.GAME_SKIP_BODY"],
  hintAfterWrongGuess: ["Tooltips.HINT_AFTER_WRONG_TITLE", "Tooltips.HINT_AFTER_WRONG_BODY"],
  shopOutOfCoins: ["Tooltips.SHOP_OUT_OF_COINS_TITLE", "Tooltips.SHOP_OUT_OF_COINS_BODY"],
  achievementEarned: ["Tooltips.ACHIEVEMENT_EARNED_TITLE", "Tooltips.ACHIEVEMENT_EARNED_BODY"],
  leaderboardFifthCorrectAnswer: [
    "Tooltips.LEADERBOARD_FIFTH_CORRECT_TITLE",
    "Tooltips.LEADERBOARD_FIFTH_CORRECT_BODY",
  ],
  classicFromDaily: ["Tooltips.CLASSIC_FROM_DAILY_TITLE", "Tooltips.CLASSIC_FROM_DAILY_BODY"],
  profileProgression: ["Tooltips.PROFILE_PROGRESSION_TITLE", "Tooltips.PROFILE_PROGRESSION_BODY"],
  profileIdentity: ["Tooltips.PROFILE_IDENTITY_TITLE", "Tooltips.PROFILE_IDENTITY_BODY"],
  profileDailyPuzzles: ["Tooltips.PROFILE_DAILY_PUZZLES_TITLE", "Tooltips.PROFILE_DAILY_PUZZLES_BODY"],
  profileStats: ["Tooltips.PROFILE_STATS_TITLE", "Tooltips.PROFILE_STATS_BODY"],
  profileCoins: ["Tooltips.PROFILE_COINS_TITLE", "Tooltips.PROFILE_COINS_BODY"],
  profileAchievements: ["Tooltips.PROFILE_ACHIEVEMENTS_TITLE", "Tooltips.PROFILE_ACHIEVEMENTS_BODY"],
  profileStatistics: ["Tooltips.PROFILE_STATISTICS_TITLE", "Tooltips.PROFILE_STATISTICS_BODY"],
  profileLeaderboard: ["Tooltips.PROFILE_LEADERBOARD_TITLE", "Tooltips.PROFILE_LEADERBOARD_BODY"],
};

const tooltipSelector: Partial<Record<TooltipId, string>> = {
  gameCoins: "[data-tooltip='gameCoins']",
  gameHint: "[data-tooltip='gameHint']",
  submitAnswer: "[data-tooltip='submitAnswer']",
  gameSkip: "[data-tooltip='gameSkip']",
  profileIdentity: "[data-tooltip='profileIdentity']",
  profileProgression: "[data-tooltip='profileProgression']",
  profileDailyPuzzles: "[data-tooltip='profileDailyPuzzles']",
  profileStats: "[data-tooltip='profileStats']",
  profileCoins: "[data-tooltip='profileCoins']",
  profileAchievements: "[data-tooltip='profileAchievements']",
  profileStatistics: "[data-tooltip='profileStatistics']",
  profileLeaderboard: "[data-tooltip='profileLeaderboard']",
};

const storageKey = (kind: string, userId?: string) => `riddleQuest:${kind}:${userId ?? "anonymous"}`;

export function GuidanceOverlay({
  state,
  modal,
  onActiveChange,
}: {
  state: GameSessionState;
  modal: GameModal;
  onActiveChange?: (active: boolean) => void;
}) {
  useLocale();
  const userId = state.user?.uid;
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [welcomeOnly, setWelcomeOnly] = useState(false);
  const [sequence, setSequence] = useState<TooltipId[]>([]);
  const [sequenceName, setSequenceName] = useState<string | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const onboardingCardRef = useRef<HTMLElement | null>(null);
  const activeTooltip = sequence[sequenceIndex];

  useEffect(() => {
    onboardingCardRef.current?.scrollTo({top: 0});
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingStep !== 2 || state.user?.platformRegistered !== false) return;
    window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-opened"));
    const closePrompt = () => {
      localStorage.setItem(storageKey("onboarding", userId), "seen");
      setOnboardingStep(null);
    };
    window.addEventListener("riddle-quest:registration-prompt-closed", closePrompt);
    return () => window.removeEventListener("riddle-quest:registration-prompt-closed", closePrompt);
  }, [onboardingStep, state.user?.platformRegistered, userId]);

  useEffect(() => {
    const active = onboardingStep !== null || Boolean(activeTooltip);
    onActiveChange?.(active);
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
  }, [activeTooltip, onActiveChange, onboardingStep]);

  useEffect(() => {
    if (!state.riddle || onboardingStep !== null || sequence.length > 0) {
      return;
    }
    const hasCompletedOnboarding =
      localStorage.getItem(storageKey("onboarding", userId)) === "seen";
    if (sessionStorage.getItem(storageKey("welcomeSession", userId)) !== "seen") {
      setWelcomeOnly(hasCompletedOnboarding);
      setOnboardingStep(0);
      return;
    }
    if (!hasCompletedOnboarding) {
      setWelcomeOnly(false);
      setOnboardingStep(0);
      return;
    }
    if (localStorage.getItem(storageKey("tooltipSequenceSeen:gameTour", userId)) !== "seen") {
      setSequence(GAME_TOUR);
      setSequenceName("gameTour");
      setSequenceIndex(0);
    }
  }, [onboardingStep, sequence.length, state.riddle, userId]);

  useEffect(() => {
    if (
      modal === "profile" &&
      onboardingStep === null &&
      sequence.length === 0 &&
      localStorage.getItem(storageKey("tooltipSequenceSeen:profileTour", userId)) !== "seen"
    ) {
      const timer = window.setTimeout(() => {
        setSequence(PROFILE_TOUR);
        setSequenceName("profileTour");
        setSequenceIndex(0);
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [modal, onboardingStep, sequence.length, userId]);

  useEffect(() => {
    if (
      onboardingStep !== null ||
      sequence.length > 0 ||
      localStorage.getItem(storageKey("onboarding", userId)) !== "seen" ||
      localStorage.getItem(storageKey("tooltipSequenceSeen:gameTour", userId)) !== "seen"
    ) {
      return;
    }
    const candidates: Array<{id: TooltipId; when: boolean}> = [
      {
        id: "achievementEarned",
        when: modal === null && (state.lastRewards?.newlyUnlockedAchievementIds.length ?? 0) > 0,
      },
      {
        id: "leaderboardFifthCorrectAnswer",
        when:
          modal === null &&
          state.lastOutcome?.kind === "win" &&
          (state.profile?.totalWins ?? state.profile?.wins ?? 0) >= 5,
      },
      {
        id: "classicFromDaily",
        when: modal === null && state.lastOutcome?.kind === "win" && state.gameMode === "challenge",
      },
      {
        id: "shopOutOfCoins",
        when: modal === "shop" && (state.profile?.coins ?? 0) === 0,
      },
      {
        id: "hintAfterWrongGuess",
        when: modal === null && state.guesses.length > 0 && !state.lastOutcome,
      },
    ];
    const candidate = candidates.find(
      ({id, when}) =>
        when && localStorage.getItem(storageKey(`tooltipSeen:${id}`, userId)) !== "seen",
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
      const selector = tooltipSelector[activeTooltip];
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
    const [title, body] = tooltipKeys[activeTooltip];
    return {title: tr(title), body: tr(body)};
  }, [activeTooltip]);

  const finishSequence = () => {
    if (sequenceName?.startsWith("contextual:")) {
      localStorage.setItem(storageKey(`tooltipSeen:${sequenceName.slice("contextual:".length)}`, userId), "seen");
    } else if (sequenceName) {
      localStorage.setItem(storageKey(`tooltipSequenceSeen:${sequenceName}`, userId), "seen");
    }
    setSequence([]);
    setSequenceName(null);
    setSequenceIndex(0);
  };

  if (onboardingStep !== null) {
    const isWelcome = onboardingStep === 0;
    const isGuestNotice = onboardingStep === 2;
    const totalSteps = state.user?.platformRegistered === false ? 3 : 2;
    return (
      <div className="guidance-backdrop" role="presentation">
        <SpinningWheel />
        <section
          ref={onboardingCardRef}
          className={`onboarding-card${isWelcome ? " onboarding-card-welcome" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          {!welcomeOnly && (
            <span className="onboarding-progress">{onboardingStep + 1}/{totalSteps}</span>
          )}
          {isWelcome ? (
            <img id="onboarding-title" className="onboarding-logo" src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
          ) : (
            <h2 id="onboarding-title">
              {isGuestNotice ? tr("Profile.GUEST_MODE_TITLE") : tr("Instructions.GOAL_TITLE")}
            </h2>
          )}
          {isWelcome ? (
            <>
              <p>{tr("WelcomeModal.SOLVE_RIDDLES_TEXT")}</p>
              <p>{tr("WelcomeModal.EARN_COINS_TEXT")}</p>
            </>
          ) : isGuestNotice ? (
            <>
              <p>{tr("GameScreenAlerts.GUEST_MODE_NOTICE_MESSAGE")}</p>
              <button
                className="play-secondary"
                onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:register-player"))}
              >
                {tr("Profile.UPGRADE_ACCOUNT_BUTTON")}
              </button>
            </>
          ) : (
            <>
              <p>{tr("Instructions.GOAL_DESCRIPTION")}</p>
              <div className="onboarding-clues">
                <span><i className="clue green">A</i>{tr("Instructions.COLOR_CORRECT")}</span>
                <span><i className="clue yellow">B</i>{tr("Instructions.COLOR_MISPLACED")}</span>
                <span><i className="clue red">C</i>{tr("Instructions.COLOR_WRONG")}</span>
              </div>
              <p>{tr("Instructions.TIPS_DESCRIPTION")}</p>
            </>
          )}
          <button
            className="play-primary"
            onClick={() => {
              if (isWelcome) {
                sessionStorage.setItem(storageKey("welcomeSession", userId), "seen");
                if (welcomeOnly) {
                  setOnboardingStep(null);
                  return;
                }
                setOnboardingStep(1);
                return;
              }
              if (!isGuestNotice && totalSteps === 3) {
                setOnboardingStep(2);
                return;
              }
              if (isGuestNotice) {
                window.dispatchEvent(new CustomEvent("riddle-quest:dismiss-registration"));
                return;
              }
              localStorage.setItem(storageKey("onboarding", userId), "seen");
              setOnboardingStep(null);
            }}
          >
            {isWelcome
              ? tr("WelcomeModal.LETS_PLAY")
              : isGuestNotice
                ? tr("CommonAlerts.OK_BUTTON")
                : tr("Instructions.GOT_IT_BUTTON")}
          </button>
        </section>
      </div>
    );
  }

  if (!activeTooltip || !tooltipContent) {
    return null;
  }

  const panelStyle =
    targetRect && targetRect.bottom < window.innerHeight * 0.58
      ? {top: targetRect.bottom + 18}
      : targetRect
        ? {bottom: window.innerHeight - targetRect.top + 18}
        : {top: "50%", transform: "translate(-50%, -50%)"};

  return (
    <div className="tooltip-backdrop" role="presentation">
      {targetRect && (
        <div
          className="tooltip-spotlight"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}
      <section className="tooltip-card" role="dialog" aria-modal="true" style={panelStyle}>
        <small>{sequenceIndex + 1}/{sequence.length}</small>
        <h3>{tooltipContent.title}</h3>
        <p>{tooltipContent.body}</p>
        <button
          className="play-primary compact"
          onClick={() => {
            if (sequenceIndex + 1 >= sequence.length) {
              finishSequence();
            } else {
              setSequenceIndex((index) => index + 1);
            }
          }}
        >
          {tr("Tooltips.GOT_IT_BUTTON")}
        </button>
      </section>
    </div>
  );
}
