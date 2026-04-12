/**
 * @fileoverview Chinese (zh) locale overrides.
 */
import type { LocaleOverrides } from "./types";

export const zhOverrides: LocaleOverrides = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "加入数百万人一起玩QWORDLY。",
      TAGLINE_2: "准备好在娱乐中锻炼思维了吗？",
      SIGN_IN_BUTTON: "登录",
      OR_SIGN_IN_WITH: "或使用",
      NO_ACCOUNT_PROMPT: "还没有账号？ ",
    },
    Login: {
      TITLE: "登录",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "请输入邮箱",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "请输入密码",
      FORGOT_PASSWORD: "忘记密码？",
      LOGIN_BUTTON: "登录",
      REGISTER_NOW: "立即注册",
    },
    SignUp: {
      TITLE: "创建账号",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "请输入用户名",
      NEXT_BUTTON: "下一步",
      LOGIN_NOW: "登录",
    },
  },
  Navigation: {
    PLAY_BUTTON: "开始",
    PROFILE_BUTTON: "个人资料",
    SETTINGS_BUTTON: "设置",
    HINT_BUTTON: "提示",
  },
  Settings: {
    TITLE: "设置",
    SOUND_TOGGLE: "声音",
    HAPTICS_TOGGLE: "震动",
    LANGUAGE_LABEL: "语言",
    HELP_BUTTON: "帮助",
    LOGOUT_BUTTON: "退出登录",
    CREDITS_BUTTON: "制作名单",
    CLOSE_BUTTON: "关闭",
  },
  Profile: {
    TITLE: "个人资料",
    SAVE_BUTTON: "保存",
    EDIT_BUTTON: "编辑",
    STATS_TITLE: "统计",
  },
};
