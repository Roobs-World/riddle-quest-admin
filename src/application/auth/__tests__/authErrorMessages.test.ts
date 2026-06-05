const mockCaptureException = jest.fn();

jest.mock("../../../i18n", () => {
  const translations: Record<string, string> = {
    "ErrorMessages.AUTHENTICATION_FAILED": "Authentication failed",
    "ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION": "Network error. Please check your connection.",
    "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE": "Service temporarily unavailable. Please try again.",
    "ErrorMessages.UNKNOWN_ERROR": "Unknown error occurred",
    "Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE":
      "That provider account is already in use. Please choose a different provider.",
  };

  return {
    t: (key: string) => translations[key] ?? key,
  };
});

jest.mock("../../../utils/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import {
  getAuthErrorMessage,
  getFacebookSignInErrorMessage,
  getGoogleSignInErrorMessage,
  isAccountAlreadyInUseError,
  isFacebookLoginCancellation,
  isGoogleSignInCancellation,
} from "../authErrorMessages";

describe("authErrorMessages", () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it("resolves known Google and Facebook mappings", () => {
    expect(
      getGoogleSignInErrorMessage({
        code: "auth/account-exists-with-different-credential",
      }),
    ).toBe("That provider account is already in use. Please choose a different provider.");

    expect(getFacebookSignInErrorMessage({code: "auth/network-request-failed"})).toBe(
      "Network error. Please check your connection.",
    );

    expect(
      getFacebookSignInErrorMessage({
        message: "Facebook permission request timed out waiting for the login flow.",
      }),
    ).toBe("Service temporarily unavailable. Please try again.");
  });

  it("keeps cancellation cases silent", () => {
    expect(getGoogleSignInErrorMessage({type: "cancelled"})).toBeNull();
    expect(getFacebookSignInErrorMessage({code: "auth/auth-popup-closed-by-user"})).toBeNull();
    expect(isGoogleSignInCancellation({code: "auth/auth-popup-closed-by-user"})).toBe(true);
    expect(isFacebookLoginCancellation({message: "User cancelled the login process"})).toBe(true);
  });

  it("formats unknown errors with localized text and the raw error code", () => {
    const result = getAuthErrorMessage({code: "auth/unknown-error", message: "Something broke"}, "google");

    expect(result).toBe("Unknown error occurred (auth/unknown-error)");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    const capturedError = mockCaptureException.mock.calls[0][0] as Error;
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe("Unhandled auth google error: auth/unknown-error");
  });

  it("detects account-in-use errors", () => {
    expect(isAccountAlreadyInUseError({message: "[auth/email-already-in-use] already associated"})).toBe(true);
  });
});
