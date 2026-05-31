import {AppStrings} from "../../constants/AppStrings";
import {
  ErrorMessageResolver,
  createCodeMapStrategy,
  extractErrorMessage,
} from "../../utils/errorResolution";

const UPDATE_USERNAME_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy(
      "UpdateUsernameFunctionsCodes",
      {
        "already-exists": AppStrings.Profile?.ALERT_USERNAME_ALREADY_TAKEN ?? "Username already taken.",
      },
      {
        normalizeCode: (code: string) => code.trim().toLowerCase().replace(/^functions\//, ""),
      },
    ),
    {
      name: "UpdateUsernameMessageFallback",
      matches: (error: unknown): boolean => typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => {
        const message = extractErrorMessage(error);
        if (!message) {
          return null;
        }

        return message.replace(/^\[[^\]]+\]\s*/, "").trim();
      },
    },
  ],
  {
    fallbackMessage: AppStrings.Profile?.ALERT_AN_ERROR_OCCURRED ?? "An error occurred.",
  },
);

export const getUpdateUsernameErrorMessage = (error: unknown): string => {
  return UPDATE_USERNAME_ERROR_RESOLVER.resolve(error);
};
