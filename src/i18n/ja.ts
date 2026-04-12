/**
 * @fileoverview Japanese (ja) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const jaOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "何百万人ものユーザーと一緒にQWORDLYを楽しもう。",
      TAGLINE_2: "遊びながら頭を鍛える準備はできていますか？",
      SIGN_IN_BUTTON: "ログイン",
      OR_SIGN_IN_WITH: "または",
      NO_ACCOUNT_PROMPT: "アカウントをお持ちでないですか？ ",
    },
    Login: {
      TITLE: "ログイン",
      EMAIL_LABEL: "メールアドレス",
      EMAIL_PLACEHOLDER: "メールアドレスを入力",
      PASSWORD_LABEL: "パスワード",
      PASSWORD_PLACEHOLDER: "パスワードを入力",
      FORGOT_PASSWORD: "パスワードをお忘れですか？",
      LOGIN_BUTTON: "ログイン",
      REGISTER_NOW: "今すぐ登録",
    },
    SignUp: {
      TITLE: "アカウント作成",
      USERNAME_LABEL: "ユーザー名",
      USERNAME_PLACEHOLDER: "ユーザー名を入力",
      NEXT_BUTTON: "次へ",
      LOGIN_NOW: "ログイン",
    },
    NewPassword: {
      TITLE: "新しいパスワードを設定",
      SET_PASSWORD_BUTTON: "確認",
    },
  },
  Navigation: {
    PLAY_BUTTON: "プレイ",
    PROFILE_BUTTON: "プロフィール",
    SETTINGS_BUTTON: "設定",
    HINT_BUTTON: "ヒント",
  },
  Settings: {
    TITLE: "設定",
    SOUND_TOGGLE: "サウンド",
    HAPTICS_TOGGLE: "触覚",
    LANGUAGE_LABEL: "言語",
    HELP_BUTTON: "ヘルプ",
    LOGOUT_BUTTON: "ログアウト",
    CREDITS_BUTTON: "クレジット",
    CLOSE_BUTTON: "閉じる",
  },
  Profile: {
    TITLE: "プロフィール",
    SAVE_BUTTON: "保存",
    EDIT_BUTTON: "編集",
    STATS_TITLE: "統計",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "推測回数がなくなりました。広告を見てコインを獲得しますか？",
    WATCH_AD_BUTTON: "広告を見る",
    NO_THANKS_BUTTON: "結構です",
  },
};
