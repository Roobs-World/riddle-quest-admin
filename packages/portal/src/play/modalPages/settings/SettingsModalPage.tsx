import {LiveRacePushConsent} from "../../race/components/LiveRacePushConsent";
import {useContext, type ChangeEvent} from "react";
import {ProfileSubscriptionContext} from "../profile/ProfileSubscriptionContext";
import type {GameModal} from "@riddle-quest/hosted/play/gameSession";
import {LANGUAGE_OPTIONS, useTranslator, type Locale} from "../../i18n";
import {setPlayerLocale} from "../../playerPreferences";

/** Props required by the settings modal page. */
export type SettingsModalPageProps = {
  /** Stores locale. */
  locale: string;
  /** Stores muted. */
  muted: boolean;
  /** Stores on open modal. */
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  /** Stores on toggle mute. */
  onToggleMute: () => void;
  /** Shows the platform shop only when a verified catalog is available. */
  commerceAvailable?: boolean;
};

/** Renders sound, language, help, legal, and shop settings. */
export function SettingsModalPage({
  locale,
  muted,
  onOpenModal,
  onToggleMute,
  commerceAvailable = true,
}: SettingsModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Target-specific subscription management shared with Profile. */
  const subscriptionControls = useContext(ProfileSubscriptionContext);
  /** Persists and immediately activates the selected locale. */
  const changeLocale = (event: ChangeEvent<HTMLSelectElement>) => {
    /** Provides next locale behavior. */
    const nextLocale = event.target.value as Locale;
    setPlayerLocale(nextLocale);
  };

  return (
    <div className="settings-page">
      <button className="settings-row" onClick={onToggleMute}>
        <span>{tr("Settings.SOUND_TOGGLE")}</span>
        <strong>{muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}</strong>
      </button>
      <LiveRacePushConsent />
      <label className="settings-row">
        <span>{tr("Settings.LANGUAGE_LABEL")}</span>
        <select value={locale} onChange={changeLocale}>
          {LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </select>
      </label>
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
      {commerceAvailable && (
        <button className="settings-row" onClick={() => onOpenModal("shop")}>
          <span>{tr("Navigation.BUY_COINS_BUTTON")}</span>
          <strong aria-hidden="true">›</strong>
        </button>
      )}
      {subscriptionControls}
    </div>
  );
}
