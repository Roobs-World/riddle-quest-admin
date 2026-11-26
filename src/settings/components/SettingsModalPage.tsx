import {NotificationSettings} from "../../notifications/components/NotificationSettings";
import {AnalyticsConsentControls} from "../../observability/analytics/AnalyticsConsentControls";
import {useContext, useSyncExternalStore} from "react";
import {ProfileSubscriptionContext} from "../../accounts/browser/ProfileSubscriptionContext";
import type {GameModal} from "../../gameplay/session/gameSession";
import {useTranslator} from "../../localization/browser/i18n";
import {
  isPlayerReducedMotionEnabled,
  setPlayerReducedMotion,
  subscribeToPlayerReducedMotion,
} from "../browser/playerPreferences";

/** Props required by the settings modal page. */
export type SettingsModalPageProps = {
  /** Stores locale. */
  locale: string;
  /** Stores muted. */
  muted: boolean;
  /** Keeps account-linked notifications disabled for platform guests. */
  platformRegistered?: boolean;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
};

/** Renders sound, accessibility, language, help, and legal settings. */
export function SettingsModalPage({
  locale,
  muted,
  platformRegistered,
  onOpenModal,
  onToggleMute,
}: SettingsModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Target-specific subscription management shared with Profile. */
  const subscriptionControls = useContext(ProfileSubscriptionContext);
  /** Applied accessibility choices also update when the platform restores preferences. */
  const reducedMotion = useSyncExternalStore(subscribeToPlayerReducedMotion, isPlayerReducedMotionEnabled, () => false);
  return (
    <div className="settings-page">
      <button className="settings-row" onClick={onToggleMute}>
        <span>{tr("Settings.SOUND_TOGGLE")}</span>
        <strong>{muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}</strong>
      </button>
      <button className="settings-row" aria-pressed={reducedMotion} onClick={() => setPlayerReducedMotion(!reducedMotion)}>
        <span>{tr("Settings.REDUCED_MOTION")}</span>
        <strong>{reducedMotion ? tr("Settings.TOGGLE_ON") : tr("Settings.TOGGLE_OFF")}</strong>
      </button>
      <NotificationSettings disabled={platformRegistered === false} />
      <AnalyticsConsentControls />
      <button className="settings-row" onClick={() => onOpenModal("instructions")}>
        <span>{tr("Settings.HELP_BUTTON")}</span>
        <strong aria-hidden="true">›</strong>
      </button>
      <button className="settings-row" onClick={() => onOpenModal("credits")}>
        <span>{tr("Settings.CREDITS_BUTTON")}</span>
        <strong aria-hidden="true">›</strong>
      </button>
      <button className="settings-row" onClick={() => onOpenModal("about")}>
        <span>{tr("Settings.ABOUT_BUTTON")}</span>
        <strong aria-hidden="true">›</strong>
      </button>
      {subscriptionControls}
    </div>
  );
}
