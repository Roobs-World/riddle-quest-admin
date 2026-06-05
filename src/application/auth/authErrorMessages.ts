import type {FirebaseAuthTypes} from "@react-native-firebase/auth";
import {t} from "../../i18n";
import {
  ErrorMessageResolver,
  createCodeMapStrategy,
  createMessageContainsStrategy,
  extractErrorCode,
  extractErrorMessage,
} from "../../utils/errorResolution";

const GOOGLE_CANCELLATION_CODES = new Set([
  "auth/auth-popup-closed-by-user",
  "auth/cancelled-popup-request",
  "SIGN_IN_CANCELLED",
  "sign_in_cancelled",
]);

const FACEBOOK_CANCELLATION_CODES = new Set(["auth/auth-popup-closed-by-user", "auth/cancelled-popup-request"]);

const GOOGLE_CANCELLATION_MESSAGES = [
  "Google sign-in cancelled by user",
  "User cancelled the login flow",
  "User cancelled the login process",
];

const FACEBOOK_CANCELLATION_MESSAGES = [
  "User cancelled the login process",
  "Facebook login cancelled.",
  "User cancelled the login flow",
  "Account linking cancelled by user",
];

const ACCOUNT_CONFLICT_CODES = new Set([
  "auth/account-exists-with-different-credential",
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
]);

const copy = (key: Parameters<typeof t>[0]): string => t(key);

const LOGIN_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("LoginFirebaseCodes", {
      "auth/invalid-email": copy("AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR"),
      "auth/user-not-found": copy("AuthStrings.Login.USER_NOT_FOUND_ERROR"),
      "auth/wrong-password": copy("AuthStrings.Login.WRONG_PASSWORD_ERROR"),
      "auth/invalid-credential": copy("AuthStrings.Login.WRONG_PASSWORD_ERROR"),
      "auth/user-disabled": copy("AuthStrings.Login.USER_DISABLED_ERROR"),
    }),
    {
      name: "LoginMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: copy("AuthStrings.Login.LOGIN_FAILED_GENERIC"),
  },
);

const SIGN_UP_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("SignUpFirebaseCodes", {
      "auth/email-already-in-use": copy("AuthStrings.SignUp.EMAIL_ALREADY_IN_USE_ERROR"),
      "auth/invalid-email": copy("AuthStrings.SignUp.INVALID_EMAIL_ERROR"),
      "auth/operation-not-allowed": copy("AuthStrings.SignUp.OPERATION_NOT_ALLOWED_ERROR"),
      "auth/weak-password": copy("AuthStrings.SignUp.WEAK_PASSWORD_ERROR"),
    }),
    {
      name: "SignUpMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: copy("AuthStrings.SignUp.SIGNUP_UNEXPECTED_ERROR"),
  },
);

const FORGOT_PASSWORD_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("ForgotPasswordFirebaseCodes", {
      "auth/user-not-found": copy("AuthStrings.ForgotPassword.USER_NOT_FOUND_ERROR"),
    }),
    {
      name: "ForgotPasswordMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: copy("AuthStrings.ForgotPassword.GENERIC_ERROR"),
  },
);

const FACEBOOK_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createMessageContainsStrategy("FacebookDiagnosticPatterns", [
      {
        pattern: "access token",
        message: copy("AuthStrings.Login.FACEBOOK_CONFIG_ERROR"),
      },
      {
        pattern: "Facebook permission request timed out",
        message: copy("AuthStrings.Login.FACEBOOK_TIMEOUT_ERROR"),
      },
      {
        pattern: "Facebook SDK not properly initialized",
        message: copy("AuthStrings.Login.FACEBOOK_SDK_ERROR"),
      },
    ]),
    createCodeMapStrategy("FacebookFirebaseCodes", {
      "auth/account-exists-with-different-credential":
        copy("AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL"),
      "auth/operation-not-supported-in-this-environment": copy(
        "AuthStrings.Login.OPERATION_NOT_SUPPORTED_ERROR",
      ),
      "auth/network-request-failed": copy(
        "AuthStrings.Login.FACEBOOK_NETWORK_ERROR",
      ),
      "auth/invalid-credential": copy(
        "AuthStrings.Login.FACEBOOK_INVALID_CREDENTIAL_ERROR",
      ),
    }),
    {
      name: "FacebookMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: copy("AuthStrings.Login.FACEBOOK_UNEXPECTED_ERROR"),
  },
);

const GOOGLE_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("GoogleFirebaseCodes", {
      "auth/account-exists-with-different-credential":
        copy("AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL"),
    }),
    {
      name: "GoogleMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: () => null,
    },
  ],
  {
    fallbackMessage: copy("AuthStrings.Login.GOOGLE_UNEXPECTED_ERROR"),
  },
);

const normalizeAuthCode = (code: string): string => code.trim().toLowerCase();

export const isGoogleSignInCancellation = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const errorMessage = extractErrorMessage(error);
  if (errorMessage && GOOGLE_CANCELLATION_MESSAGES.some((message) => errorMessage.includes(message))) {
    return true;
  }

  const maybeError = error as {isCancelled?: unknown; type?: unknown};
  if (maybeError.isCancelled === true || maybeError.type === "cancelled") {
    return true;
  }

  const code = extractErrorCode(error);
  if (!code) {
    return false;
  }

  return GOOGLE_CANCELLATION_CODES.has(code) || GOOGLE_CANCELLATION_CODES.has(normalizeAuthCode(code));
};

export const isFacebookLoginCancellation = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const errorMessage = extractErrorMessage(error);
  if (errorMessage && FACEBOOK_CANCELLATION_MESSAGES.some((message) => errorMessage.includes(message))) {
    return true;
  }

  const code = extractErrorCode(error);
  if (!code) {
    return false;
  }

  const maybeError = error as {isCancelled?: unknown};
  if (maybeError.isCancelled === true) {
    return true;
  }

  return FACEBOOK_CANCELLATION_CODES.has(code) || FACEBOOK_CANCELLATION_CODES.has(normalizeAuthCode(code));
};

export const isAccountAlreadyInUseError = (error: unknown): boolean => {
  const code = extractErrorCode(error);
  if (code && ACCOUNT_CONFLICT_CODES.has(normalizeAuthCode(code))) {
    return true;
  }

  const message = extractErrorMessage(error)?.toLowerCase() ?? "";
  return (
    message.includes("auth/credential-already-in-use") ||
    message.includes("auth/email-already-in-use") ||
    message.includes("auth/account-exists-with-different-credential") ||
    message.includes("credential is already associated")
  );
};

export const getLoginErrorMessage = (error: unknown): string => LOGIN_ERROR_RESOLVER.resolve(error);

export const getSignUpErrorMessage = (error: unknown): string => SIGN_UP_ERROR_RESOLVER.resolve(error);

export const getForgotPasswordErrorMessage = (error: unknown): string => FORGOT_PASSWORD_ERROR_RESOLVER.resolve(error);

export const getGoogleSignInErrorMessage = (error: unknown): string => GOOGLE_ERROR_RESOLVER.resolve(error);

export const getFacebookSignInErrorMessage = (error: unknown): string => FACEBOOK_ERROR_RESOLVER.resolve(error);

export const getAuthErrorMessage = (error: unknown): string => {
  const code = extractErrorCode(error);
  if (code && normalizeAuthCode(code) === "auth/account-exists-with-different-credential") {
    return copy("AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL");
  }

  return copy("AuthStrings.Login.GOOGLE_UNEXPECTED_ERROR");
};

export type NativeFirebaseAuthError = FirebaseAuthTypes.NativeFirebaseAuthError;
