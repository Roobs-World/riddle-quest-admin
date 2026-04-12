/**
 * @fileoverview German (de) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const deOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Spiele mit Millionen Menschen QWORDLY.",
      TAGLINE_2: "Bereit fur Spass und Gehirntraining?",
      SIGN_IN_BUTTON: "Anmelden",
      OR_SIGN_IN_WITH: "oder anmelden mit",
      NO_ACCOUNT_PROMPT: "Noch kein Konto? ",
    },
    Login: {
      TITLE: "Anmelden",
      EMAIL_LABEL: "E-Mail",
      EMAIL_PLACEHOLDER: "E-Mail eingeben",
      PASSWORD_LABEL: "Passwort",
      PASSWORD_PLACEHOLDER: "Passwort eingeben",
      FORGOT_PASSWORD: "Passwort vergessen?",
      LOGIN_BUTTON: "Anmelden",
      NO_ACCOUNT_PROMPT: "Noch kein Konto? ",
      REGISTER_NOW: "Jetzt registrieren",
      OR_LOGIN_WITH: "Oder anmelden mit",
      INVALID_EMAIL_FORMAT_ERROR: "Ungueltiges E-Mail-Format",
      LOGIN_FAILED_GENERIC: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
    },
    SignUp: {
      TITLE: "Konto erstellen",
      USERNAME_LABEL: "Benutzername",
      USERNAME_PLACEHOLDER: "Benutzernamen eingeben",
      EMAIL_LABEL: "E-Mail",
      EMAIL_PLACEHOLDER: "E-Mail eingeben",
      PASSWORD_LABEL: "Passwort",
      PASSWORD_PLACEHOLDER: "Passwort eingeben",
      CONFIRM_PASSWORD_LABEL: "Passwort bestaetigen",
      CONFIRM_PASSWORD_PLACEHOLDER: "Passwort erneut eingeben",
      NEXT_BUTTON: "Weiter",
      HAS_ACCOUNT_PROMPT: "Haben Sie bereits ein Konto? ",
      LOGIN_NOW: "Jetzt anmelden",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Spielen",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Einstellungen",
    HINT_BUTTON: "Hinweis",
  },
  Settings: {
    TITLE: "Einstellungen",
    SOUND_TOGGLE: "Ton",
    HAPTICS_TOGGLE: "Haptik",
    LANGUAGE_LABEL: "Sprache",
    HELP_BUTTON: "Hilfe",
    LOGOUT_BUTTON: "Abmelden",
    CREDITS_BUTTON: "Credits",
    CLOSE_BUTTON: "Schliessen",
    LOGOUT_ERROR_TITLE: "Fehler",
    LOGOUT_ERROR_MESSAGE: "Abmelden fehlgeschlagen. Bitte erneut versuchen.",
  },
  Profile: {
    LOADING_MESSAGE: "Profildaten werden geladen...",
    TITLE: "Profil",
    USERNAME_LABEL: "Benutzername:",
    SAVE_BUTTON: "Speichern",
    EDIT_BUTTON: "Bearbeiten",
    STATS_TITLE: "Statistiken",
    CHANGE_PASSWORD_BUTTON: "Passwort aendern",
    CHANGE_AVATAR_TITLE: "Avatar aendern",
    CHOOSE_FROM_GALLERY_BUTTON: "Aus Galerie waehlen",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Raetsel konnten nicht geladen werden. Verbindung pruefen.",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Fehler",
    SUBMIT_GUESS_ERROR_MESSAGE:
      "Tipp konnte nicht gesendet werden. Bitte erneut versuchen.",
    NOT_ENOUGH_COINS_TITLE: "Nicht genug Muenzen",
    NOT_ENOUGH_COINS_MESSAGE: "Sie brauchen mehr Muenzen fuer einen Hinweis.",
    HINT_ERROR_TITLE: "Fehler",
  },
};
