import {t} from "../../i18n";
import {extractErrorCode, extractErrorMessage} from "../../utils/errorResolution";
import {captureException} from "../../utils/sentry";

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

type TranslateFn = typeof t;

export type AuthProvider = "google" | "facebook";

const normalizeAuthCode = (code: string): string => code.trim().toLowerCase();

const buildUnknownAuthError = (provider: AuthProvider, error: unknown): Error => {
  const code = extractErrorCode(error);
  const suffix = code ? `: ${code}` : "";
  return new Error(`Unhandled auth ${provider} error${suffix}`);
};

const formatUnknownAuthMessage = (translate: TranslateFn, error: unknown): string => {
  const code = extractErrorCode(error);
  const baseMessage = translate("ErrorMessages.UNKNOWN_ERROR");
  return code ? `${baseMessage} (${code})` : baseMessage;
};

const resolveGoogleKnownErrorMessage = (error: unknown, translate: TranslateFn): string | null => {
  if (isAccountAlreadyInUseError(error)) {
    return translate("Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE");
  }

  const code = extractErrorCode(error)?.toLowerCase() ?? "";
  if (code === "auth/network-request-failed") {
    return translate("ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION");
  }
  if (code === "auth/invalid-credential") {
    return translate("ErrorMessages.AUTHENTICATION_FAILED");
  }

  return null;
};

const resolveFacebookKnownErrorMessage = (error: unknown, translate: TranslateFn): string | null => {
  const message = extractErrorMessage(error)?.toLowerCase() ?? "";
  const code = extractErrorCode(error)?.toLowerCase() ?? "";

  if (message.includes("access token")) {
    return translate("ErrorMessages.AUTHENTICATION_FAILED");
  }
  if (message.includes("facebook permission request timed out")) {
    return translate("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE");
  }
  if (message.includes("facebook sdk not properly initialized")) {
    return translate("ErrorMessages.AUTHENTICATION_FAILED");
  }
  if (isAccountAlreadyInUseError(error)) {
    return translate("Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE");
  }
  if (code === "auth/operation-not-supported-in-this-environment") {
    return translate("ErrorMessages.AUTHENTICATION_FAILED");
  }
  if (code === "auth/network-request-failed") {
    return translate("ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION");
  }
  if (code === "auth/invalid-credential") {
    return translate("ErrorMessages.AUTHENTICATION_FAILED");
  }

  return null;
};

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

export const getAuthErrorMessage = (
  error: unknown,
  provider: AuthProvider,
  translate: TranslateFn = t,
): string | null => {
  if (provider === "google" && isGoogleSignInCancellation(error)) {
    return null;
  }

  if (provider === "facebook" && isFacebookLoginCancellation(error)) {
    return null;
  }

  const knownMessage =
    provider === "google"
      ? resolveGoogleKnownErrorMessage(error, translate)
      : resolveFacebookKnownErrorMessage(error, translate);

  if (knownMessage) {
    return knownMessage;
  }

  captureException(buildUnknownAuthError(provider, error));
  return formatUnknownAuthMessage(translate, error);
};

export const getGoogleSignInErrorMessage = (error: unknown, translate: TranslateFn = t): string | null => {
  return getAuthErrorMessage(error, "google", translate);
};

export const getFacebookSignInErrorMessage = (error: unknown, translate: TranslateFn = t): string | null => {
  return getAuthErrorMessage(error, "facebook", translate);
};
