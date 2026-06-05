import {t} from "../i18n";

export const validateEmail = (email: string): string => {
  if (!email) {
    return t("AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR");
  }
  const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
  if (!emailRegex.test(email)) {
    return t("AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR");
  }
  return "";
};
