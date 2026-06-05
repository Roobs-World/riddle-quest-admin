import {z} from "zod";
import {t} from "../i18n";
import {validateUsernameForProfanity} from "../utils/profanityFilter";

export const loginSchema = z.object({
  email: z.string().email(t("AuthStrings.Validation.INVALID_EMAIL_ADDRESS")),
  password: z.string().min(6, t("AuthStrings.Validation.PASSWORD_MIN_LENGTH")),
});

export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(1, t("AuthStrings.Validation.USERNAME_REQUIRED"))
      .refine(
        (username) => {
          const profanityError = validateUsernameForProfanity(username);
          return profanityError === "";
        },
        {
          message: t("AuthStrings.Validation.USERNAME_PROFANITY"),
        },
      ),
    email: z.string().email(t("AuthStrings.Validation.INVALID_EMAIL_ADDRESS")),
    password: z.string().min(6, t("AuthStrings.Validation.PASSWORD_MIN_LENGTH")),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: t("AuthStrings.Validation.PASSWORDS_DO_NOT_MATCH"),
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
