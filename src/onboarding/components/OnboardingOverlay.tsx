import {lazy, Suspense, type RefObject} from "react";
import logoUrl from "../../../assets/images/main-logo.webp";
import {SpinningWheel} from "../../app/components/feedback/SpinningWheelLoader";
import {tr} from "../../localization/browser/i18n";
const NotificationEnrollmentPrompt = lazy(() => import("../../notifications/components/NotificationEnrollmentPrompt")
  .then(module => ({default: module.NotificationEnrollmentPrompt})));

/** Props required to present one onboarding page. */
export type OnboardingOverlayProps = {
  /** Stores card ref. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** Stores onboarding step. */
  onboardingStep: number;
  /** Stores total steps. */
  totalSteps: number;
  /** Stores welcome only. */
  welcomeOnly: boolean;
  /** Stores on advance. */
  onAdvance: () => void;
};

/** Renders welcome and instructions before uninterrupted guest play. */
export function OnboardingOverlay({
  cardRef,
  onboardingStep,
  totalSteps,
  welcomeOnly,
  onAdvance,
}: OnboardingOverlayProps) {
  /** Indicates whether is welcome. */
  const isWelcome = onboardingStep === 0;

  return (
    <div className="guidance-backdrop" role="presentation">
      <SpinningWheel />
      <div
        ref={cardRef}
        className={`onboarding-card ${isWelcome ? "onboarding-card-welcome" : "onboarding-card-instructions"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        data-analytics-screen={`onboarding_${onboardingStep + 1}`}
      >
        {!welcomeOnly ? (
          <span className="onboarding-progress">
            {onboardingStep + 1}/{totalSteps}
          </span>
        ) : null}
        {isWelcome ? (
          <img id="onboarding-title" className="onboarding-logo" src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
        ) : (
          <h2 id="onboarding-title">
            {tr("Instructions.GOAL_TITLE")}
          </h2>
        )}
        {isWelcome ? (
          <>
            <p>{tr("WelcomeModal.SOLVE_RIDDLES_TEXT")}</p>
            <p>{tr("WelcomeModal.EARN_COINS_TEXT")}</p>
            <Suspense fallback={null}><NotificationEnrollmentPrompt /></Suspense>
          </>
        ) : (
          <>
            <p>{tr("Instructions.GOAL_DESCRIPTION")}</p>
            <div className="onboarding-clues">
              <span>
                <i className="clue green">A</i>
                {tr("Instructions.COLOR_CORRECT")}
              </span>
              <span>
                <i className="clue yellow">B</i>
                {tr("Instructions.COLOR_MISPLACED")}
              </span>
              <span>
                <i className="clue red">C</i>
                {tr("Instructions.COLOR_WRONG")}
              </span>
            </div>
            <p>{tr("Instructions.TIPS_DESCRIPTION")}</p>
          </>
        )}
        <button className="play-primary" onClick={onAdvance}>
          {isWelcome ? tr("WelcomeModal.LETS_PLAY") : tr("Instructions.GOT_IT_BUTTON")}
        </button>
      </div>
    </div>
  );
}
