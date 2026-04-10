import { AppStrings } from "../constants/AppStrings";

export const validateEmail = (email: string): string => {
  if (!email) {
    return AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR;
  }
  const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
  if (!emailRegex.test(email)) {
    return AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR;
  }
  return "";
};

