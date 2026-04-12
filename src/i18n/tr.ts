/**
 * @fileoverview Turkish (tr) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const trOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "QWORDLY oynamak icin milyonlara katilin.",
      TAGLINE_2: "Eglenceli sekilde zihninizi calistirmaya hazir misiniz?",
      SIGN_IN_BUTTON: "Giris yap",
      OR_SIGN_IN_WITH: "veya su ile giris yap",
      NO_ACCOUNT_PROMPT: "Hesabin yok mu? ",
    },
    Login: {
      TITLE: "Giris",
      EMAIL_LABEL: "E-posta",
      EMAIL_PLACEHOLDER: "E-postanizi girin",
      PASSWORD_LABEL: "Sifre",
      PASSWORD_PLACEHOLDER: "Sifrenizi girin",
      FORGOT_PASSWORD: "Sifrenizi mi unuttunuz?",
      LOGIN_BUTTON: "Giris Yap",
      NO_ACCOUNT_PROMPT: "Hesabin yok mu? ",
      REGISTER_NOW: "Hemen kaydol",
    },
    SignUp: {
      TITLE: "Hesabini olustur",
      USERNAME_LABEL: "Kullanici adi",
      USERNAME_PLACEHOLDER: "Kullanici adini gir",
      EMAIL_LABEL: "E-posta",
      EMAIL_PLACEHOLDER: "E-postani gir",
      PASSWORD_LABEL: "Sifre",
      PASSWORD_PLACEHOLDER: "Sifreni gir",
      CONFIRM_PASSWORD_LABEL: "Sifreyi Onayla",
      CONFIRM_PASSWORD_PLACEHOLDER: "Sifreni tekrar gir",
      NEXT_BUTTON: "Ileri",
      HAS_ACCOUNT_PROMPT: "Zaten hesabin var mi? ",
      LOGIN_NOW: "Simdi giris yap",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Oyna",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Ayarlar",
    HINT_BUTTON: "Ipucu",
  },
  Settings: {
    TITLE: "Ayarlar",
    SOUND_TOGGLE: "Ses",
    HAPTICS_TOGGLE: "Titresim",
    LANGUAGE_LABEL: "Dil",
    HELP_BUTTON: "Yardim",
    LOGOUT_BUTTON: "Cikis yap",
    CREDITS_BUTTON: "Ekip",
    CLOSE_BUTTON: "Kapat",
  },
  Profile: {
    TITLE: "Profil",
    SAVE_BUTTON: "Kaydet",
    EDIT_BUTTON: "Duzenle",
    STATS_TITLE: "Istatistikler",
    CHANGE_PASSWORD_BUTTON: "Sifre Degistir",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "Tahmin hakkin bitti! Para kazanmak icin reklam izler misin?",
    WATCH_AD_BUTTON: "Reklam izle",
    NO_THANKS_BUTTON: "Hayir tesekkurler",
  },
};
