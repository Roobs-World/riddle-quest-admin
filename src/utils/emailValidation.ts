import { AppStrings } from "../constants/AppStrings";

export const validateEmail = (email: string): boolean => {
  if (!email) {
    return true;
  }
  const emailRegex = /^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
  return emailRegex.test(email);
};
