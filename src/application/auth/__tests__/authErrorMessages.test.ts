import {
  getFacebookSignInErrorMessage,
  getForgotPasswordErrorMessage,
  getGoogleSignInErrorMessage,
  getLoginErrorMessage,
  getSignUpErrorMessage,
  isAccountAlreadyInUseError,
  isFacebookLoginCancellation,
  isGoogleSignInCancellation,
} from "../authErrorMessages";

const mockI18n: any = {
  AppStrings: {
    AuthStrings: {
      Login: {
        INVALID_EMAIL_FORMAT_ERROR: "Invalid email format.",
        USER_NOT_FOUND_ERROR: "User not found.",
        WRONG_PASSWORD_ERROR: "Wrong password.",
        USER_DISABLED_ERROR: "User disabled.",
        LOGIN_FAILED_GENERIC: "Login failed.",
        ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "Account already exists.",
        OPERATION_NOT_SUPPORTED_ERROR: "Operation not supported.",
        FACEBOOK_NETWORK_ERROR: "Facebook network error.",
        FACEBOOK_INVALID_CREDENTIAL_ERROR: "Facebook invalid credential.",
        FACEBOOK_UNEXPECTED_ERROR: "Facebook login failed.",
        FACEBOOK_CONFIG_ERROR: "Facebook config error.",
        FACEBOOK_TIMEOUT_ERROR: "Facebook timeout.",
        FACEBOOK_SDK_ERROR: "Facebook SDK error.",
        GOOGLE_UNEXPECTED_ERROR: "Google login failed.",
      },
      SignUp: {
        EMAIL_ALREADY_IN_USE_ERROR: "Email already in use.",
        INVALID_EMAIL_ERROR: "Invalid signup email.",
        OPERATION_NOT_ALLOWED_ERROR: "Operation not allowed.",
        WEAK_PASSWORD_ERROR: "Weak password.",
        SIGNUP_UNEXPECTED_ERROR: "Signup failed.",
      },
      ForgotPassword: {
        USER_NOT_FOUND_ERROR: "Forgot password user not found.",
        GENERIC_ERROR: "Forgot password failed.",
      },
    },
  },
};

mockI18n.t = (key: string) => key.split(".").reduce((current: any, segment: string) => current?.[segment], mockI18n.AppStrings);

jest.mock("../../../i18n", () => mockI18n);

describe("authErrorMessages", () => {
  it("maps login auth codes to friendly copy", () => {
    expect(getLoginErrorMessage({code: "auth/invalid-email"})).toBe("Invalid email format.");
    expect(getLoginErrorMessage({code: "auth/user-disabled"})).toBe("User disabled.");
  });

  it("falls back to the underlying auth error message when no mapping exists", () => {
    expect(getSignUpErrorMessage({code: "auth/unknown", message: "Signup blew up"})).toBe("Signup blew up");
  });

  it("maps forgot-password failures", () => {
    expect(getForgotPasswordErrorMessage({code: "auth/user-not-found"})).toBe("Forgot password user not found.");
  });

  it("resolves Facebook diagnostics and account conflicts", () => {
    expect(getFacebookSignInErrorMessage(new Error("Facebook SDK not properly initialized"))).toBe(
      "Facebook SDK error.",
    );
    expect(getGoogleSignInErrorMessage({code: "auth/account-exists-with-different-credential"})).toBe(
      "Account already exists.",
    );
  });

  it("detects cancellation and account-conflict errors", () => {
    expect(isGoogleSignInCancellation({type: "cancelled"})).toBe(true);
    expect(isGoogleSignInCancellation({code: "auth/auth-popup-closed-by-user"})).toBe(true);
    expect(isFacebookLoginCancellation({message: "User cancelled the login process"})).toBe(true);
    expect(isAccountAlreadyInUseError({message: "[auth/email-already-in-use] already associated"})).toBe(true);
  });
});
