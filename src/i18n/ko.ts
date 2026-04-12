/**
 * @fileoverview Korean (ko) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const koOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "수백만 명과 함께 QWORDLY를 즐겨보세요.",
      TAGLINE_2: "재미있게 두뇌를 훈련할 준비가 되셨나요?",
      SIGN_IN_BUTTON: "로그인",
      OR_SIGN_IN_WITH: "또는",
      NO_ACCOUNT_PROMPT: "계정이 없으신가요? ",
    },
    Login: {
      TITLE: "로그인",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "이메일 입력",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "비밀번호 입력",
      FORGOT_PASSWORD: "비밀번호를 잊으셨나요?",
      LOGIN_BUTTON: "로그인",
      REGISTER_NOW: "지금 가입",
    },
    SignUp: {
      TITLE: "계정 만들기",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "사용자 이름 입력",
      NEXT_BUTTON: "다음",
      LOGIN_NOW: "로그인",
    },
  },
  Navigation: {
    PLAY_BUTTON: "플레이",
    PROFILE_BUTTON: "프로필",
    SETTINGS_BUTTON: "설정",
    HINT_BUTTON: "힌트",
  },
  Settings: {
    TITLE: "설정",
    SOUND_TOGGLE: "사운드",
    HAPTICS_TOGGLE: "햅틱",
    LANGUAGE_LABEL: "언어",
    HELP_BUTTON: "도움말",
    LOGOUT_BUTTON: "로그아웃",
    CREDITS_BUTTON: "크레딧",
    CLOSE_BUTTON: "닫기",
  },
  Profile: {
    TITLE: "프로필",
    SAVE_BUTTON: "저장",
    EDIT_BUTTON: "편집",
    STATS_TITLE: "통계",
  },
};
