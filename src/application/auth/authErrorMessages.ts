import type {FirebaseAuthTypes} from "@react-native-firebase/auth";
import {AppStrings} from "../../constants/AppStrings";
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

const copy = (value: string | undefined, fallback: string): string => value ?? fallback;

const loginStrings = AppStrings.AuthStrings?.Login ?? {};
const signUpStrings = AppStrings.AuthStrings?.SignUp ?? {};
const forgotPasswordStrings = AppStrings.AuthStrings?.ForgotPassword ?? {};

const LOGIN_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("LoginFirebaseCodes", {
      "auth/invalid-email": copy(loginStrings.INVALID_EMAIL_FORMAT_ERROR, "Please enter a valid email address."),
      "auth/user-not-found": copy(loginStrings.USER_NOT_FOUND_ERROR, "No account found with this email address."),
      "auth/wrong-password": copy(loginStrings.WRONG_PASSWORD_ERROR, "Incorrect password. Please try again."),
      "auth/invalid-credential": copy(loginStrings.WRONG_PASSWORD_ERROR, "Incorrect password. Please try again."),
      "auth/user-disabled": copy(loginStrings.USER_DISABLED_ERROR, "This account is disabled."),
    }),
    {
      name: "LoginMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => extractErrorMessage(error) ?? null,
    },
  ],
  {
    fallbackMessage: copy(loginStrings.LOGIN_FAILED_GENERIC, "Login failed."),
  },
);

const SIGN_UP_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("SignUpFirebaseCodes", {
      "auth/email-already-in-use": copy(signUpStrings.EMAIL_ALREADY_IN_USE_ERROR, "Email already in use."),
      "auth/invalid-email": copy(signUpStrings.INVALID_EMAIL_ERROR, "Please enter a valid email address."),
      "auth/operation-not-allowed": copy(signUpStrings.OPERATION_NOT_ALLOWED_ERROR, "Operation not allowed."),
      "auth/weak-password": copy(signUpStrings.WEAK_PASSWORD_ERROR, "Password should be at least 6 characters long."),
    }),
    {
      name: "SignUpMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => extractErrorMessage(error) ?? null,
    },
  ],
  {
    fallbackMessage: copy(signUpStrings.SIGNUP_UNEXPECTED_ERROR, "An unexpected error occurred."),
  },
);

const FORGOT_PASSWORD_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("ForgotPasswordFirebaseCodes", {
      "auth/user-not-found": copy(
        forgotPasswordStrings.USER_NOT_FOUND_ERROR,
        "No account found with this email address.",
      ),
    }),
    {
      name: "ForgotPasswordMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => extractErrorMessage(error) ?? null,
    },
  ],
  {
    fallbackMessage: copy(forgotPasswordStrings.GENERIC_ERROR, "An unexpected error occurred."),
  },
);

const FACEBOOK_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createMessageContainsStrategy("FacebookDiagnosticPatterns", [
      {
        pattern: "access token",
        message: copy(loginStrings.FACEBOOK_CONFIG_ERROR, "Facebook is not configured correctly."),
      },
      {
        pattern: "Facebook permission request timed out",
        message: copy(loginStrings.FACEBOOK_TIMEOUT_ERROR, "Facebook login timed out."),
      },
      {
        pattern: "Facebook SDK not properly initialized",
        message: copy(loginStrings.FACEBOOK_SDK_ERROR, "Facebook SDK error occurred."),
      },
    ]),
    createCodeMapStrategy("FacebookFirebaseCodes", {
      "auth/account-exists-with-different-credential":
        copy(loginStrings.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL, "Account already exists."),
      "auth/operation-not-supported-in-this-environment": copy(
        loginStrings.OPERATION_NOT_SUPPORTED_ERROR,
        "Facebook login is not supported in this environment.",
      ),
      "auth/network-request-failed": copy(
        loginStrings.FACEBOOK_NETWORK_ERROR,
        "Network error during Facebook login. Please check your connection and try again.",
      ),
      "auth/invalid-credential": copy(
        loginStrings.FACEBOOK_INVALID_CREDENTIAL_ERROR,
        "Invalid Facebook credentials. Please try again.",
      ),
    }),
    {
      name: "FacebookMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => extractErrorMessage(error) ?? null,
    },
  ],
  {
    fallbackMessage: copy(loginStrings.FACEBOOK_UNEXPECTED_ERROR, "An unexpected error occurred during Facebook login."),
  },
);

const GOOGLE_ERROR_RESOLVER = new ErrorMessageResolver(
  [
    createCodeMapStrategy("GoogleFirebaseCodes", {
      "auth/account-exists-with-different-credential":
        copy(loginStrings.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL, "Account already exists."),
    }),
    {
      name: "GoogleMessageFallback",
      matches: (error: unknown): boolean =>
        typeof error === "object" && error !== null && typeof extractErrorMessage(error) === "string",
      resolve: (error: unknown): string | null => extractErrorMessage(error) ?? null,
    },
  ],
  {
    fallbackMessage: copy(loginStrings.GOOGLE_UNEXPECTED_ERROR, "An unexpected error occurred during Google login."),
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
    return copy(loginStrings.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL, "Account already exists.");
  }

  return extractErrorMessage(error) ?? copy(loginStrings.GOOGLE_UNEXPECTED_ERROR, "An unexpected error occurred.");
};

export type NativeFirebaseAuthError = FirebaseAuthTypes.NativeFirebaseAuthError;
