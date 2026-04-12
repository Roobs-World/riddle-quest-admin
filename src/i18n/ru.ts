/**
 * @fileoverview Russian (ru) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const ruOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Prisoedinyaites k millionam igrokov QWORDLY.",
      TAGLINE_2: "Gotovy veselitsya i trenirovat um?",
      SIGN_IN_BUTTON: "Voiti",
      OR_SIGN_IN_WITH: "ili voiti cherez",
      NO_ACCOUNT_PROMPT: "Net akkaunta? ",
    },
    Login: {
      TITLE: "Vhod",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Vvedite email",
      PASSWORD_LABEL: "Parol",
      PASSWORD_PLACEHOLDER: "Vvedite parol",
      FORGOT_PASSWORD: "Zabyli parol?",
      LOGIN_BUTTON: "Voiti",
      REGISTER_NOW: "Zaregistrirovatsya",
    },
    SignUp: {
      TITLE: "Sozdat akkaunt",
      USERNAME_LABEL: "Imya polzovatelya",
      USERNAME_PLACEHOLDER: "Vvedite imya polzovatelya",
      NEXT_BUTTON: "Dalee",
      LOGIN_NOW: "Voiti",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Igrat",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Nastroiki",
    HINT_BUTTON: "Podskazka",
  },
  Settings: {
    TITLE: "Nastroiki",
    SOUND_TOGGLE: "Zvuk",
    HAPTICS_TOGGLE: "Vibratsiya",
    LANGUAGE_LABEL: "Yazyk",
    HELP_BUTTON: "Pomoshch",
    LOGOUT_BUTTON: "Vyiiti",
    CREDITS_BUTTON: "Avtory",
    CLOSE_BUTTON: "Zakryt",
  },
  Profile: {
    TITLE: "Profil",
    SAVE_BUTTON: "Sohranit",
    EDIT_BUTTON: "Izmenit",
    STATS_TITLE: "Statistika",
    CHANGE_PASSWORD_BUTTON: "Smenit parol",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Ne udalos zagruzit zagadki. Proverte soedinenie.",
  },
};
