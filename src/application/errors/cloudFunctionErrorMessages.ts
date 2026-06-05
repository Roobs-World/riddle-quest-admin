import {t} from "../../i18n";
import {
  ErrorMessageResolver,
  createCodeMapStrategy,
  extractErrorMessage,
} from "../../utils/errorResolution";

const translate = (key: Parameters<typeof t>[0]): string => {
  return t(key);
};

const UPDATE_USERNAME_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy(
      "UpdateUsernameFunctionsCodes",
      {
        "already-exists": translate("Profile.ALERT_USERNAME_ALREADY_TAKEN"),
      },
      {
        normalizeCode: (code: string) => code.trim().toLowerCase().replace(/^functions\//, ""),
      },
    ),
    {
      name: "UpdateUsernameMessageFallback",
      matches: (error: unknown): boolean => typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: translate("Profile.ALERT_AN_ERROR_OCCURRED"),
  },
);

export const getUpdateUsernameErrorMessage = (error: unknown): string => {
  return UPDATE_USERNAME_ERROR_RESOLVER.resolve(error);
};
