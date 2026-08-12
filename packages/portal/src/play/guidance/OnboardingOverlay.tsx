import type {RefObject} from "react";
import logoUrl from "../../../../../assets/images/main-logo.webp";
import {SpinningWheel} from "../SpinningWheelLoader";
import {tr} from "../i18n";

/** Props required to present one onboarding page. */
export type OnboardingOverlayProps = {
  /** Stores card ref. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** Stores onboarding step. */
  onboardingStep: number;
  /** Stores registration name. */
  registrationName?: string;
  /** Stores registration inviter name. */
  registrationInviterName?: string;
  /** Stores total steps. */
  totalSteps: number;
  /** Stores welcome only. */
  welcomeOnly: boolean;
  /** Stores on advance. */
  onAdvance: () => void;
};

/** Renders welcome, instructions, or Jest registration onboarding content. */
export function OnboardingOverlay({
  cardRef,
  onboardingStep,
  registrationName,
  registrationInviterName,
  totalSteps,
  welcomeOnly,
  onAdvance,
}: OnboardingOverlayProps) {
  const isWelcome = onboardingStep === 0;
  const isGuestNotice = onboardingStep === 2;

  return (
    <div className="guidance-backdrop" role="presentation">
      <SpinningWheel />
      <div
        ref={cardRef}
        className={`onboarding-card${isWelcome ? " onboarding-card-welcome" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        data-analytics-screen={`onboarding_${onboardingStep + 1}`}
      >
        {!welcomeOnly ? (
          <span className="onboarding-progress">{onboardingStep + 1}/{totalSteps}</span>
        ) : null}
        {isWelcome ? (
          <img id="onboarding-title" className="onboarding-logo" src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
        ) : (
          <h2 id="onboarding-title">
            {isGuestNotice ? tr("Profile.JEST_REGISTRATION_TITLE") : tr("Instructions.GOAL_TITLE")}
          </h2>
        )}
        {isWelcome ? (
          <>
            <p>{tr("WelcomeModal.SOLVE_RIDDLES_TEXT")}</p>
            <p>{tr("WelcomeModal.EARN_COINS_TEXT")}</p>
          </>
        ) : isGuestNotice ? (
          <>
            {registrationInviterName ? (
              <p>{tr("Profile.JEST_INVITED_BY", {name: registrationInviterName})}</p>
            ) : registrationName ? (
              <p>{tr("Profile.JEST_REGISTRATION_GREETING", {name: registrationName})}</p>
            ) : null}
            <p>{tr("Profile.JEST_REGISTRATION_DESCRIPTION")}</p>
            <div className="onboarding-registration-actions">
              <button
                className="play-primary"
                onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:register-player"))}
              >
                {tr("Profile.JEST_REGISTER_BUTTON")}
              </button>
              <button
                className="play-secondary"
                onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:login-player"))}
              >
                {tr("Profile.JEST_LOGIN_BUTTON")}
              </button>
              <button
                className="play-text-button"
                onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:dismiss-registration"))}
              >
                {tr("Profile.JEST_PLAY_AS_GUEST_BUTTON")}
              </button>
            </div>
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
        {!isGuestNotice ? (
          <button className="play-primary" onClick={onAdvance}>
            {isWelcome ? tr("WelcomeModal.LETS_PLAY") : tr("Instructions.GOT_IT_BUTTON")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
