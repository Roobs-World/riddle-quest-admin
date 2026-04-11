import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../LoginScreen";
import { AuthService } from "../../../services/AuthService";
import { useAuth } from "../../../contexts/AuthContext";

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
} as any;

// Mock AuthService
jest.mock("../../../services/AuthService", () => ({
  AuthService: {
    loginWithEmail: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithFacebook: jest.fn(),
    signInWithTwitter: jest.fn(),
  },
}));

// Mock useAuth hook
jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

// Mock logger
jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock sentry
jest.mock("../../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Mock components
jest.mock("../../../components/inputFields/UserEmailInput", () => {
  const React = require("react");
  return function MockUserEmailInput({ email, setEmail, errorMessage }: any) {
    return React.createElement("TextInput", {
      testID: "user-email-input",
      onChangeText: setEmail,
      value: email,
      "data-error": errorMessage,
    });
  };
});

jest.mock("../../../components/inputFields/UserPasswordInput", () => {
  const React = require("react");
  return function MockUserPasswordInput({
    password,
    setPassword,
    errorMessage,
  }: any) {
    return React.createElement("TextInput", {
      testID: "user-password-input",
      onChangeText: setPassword,
      value: password,
      "data-error": errorMessage,
    });
  };
});

jest.mock("../../../components/buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({ buttonText, onPress, disabled }: any) {
    return React.createElement(
      "View",
      {
        testID: "wide-button",
        onPress: onPress,
        "data-text": buttonText,
        "data-disabled": disabled,
      },
      React.createElement("Text", null, buttonText)
    );
  };
});

jest.mock("../../../components/buttons/BackButton", () => {
  const React = require("react");
  return function MockBackButton({ navigation }: any) {
    return React.createElement("View", {
      testID: "back-button",
      "data-navigation": navigation,
    });
  };
});

jest.mock("../../../components/buttons/GoogleSignInButton", () => {
  const React = require("react");
  return function MockGoogleSignInButton({ onPress, disabled }: any) {
    return React.createElement(
      "View",
      {
        testID: "google-signin-button",
        onPress: onPress,
        "data-disabled": disabled,
      },
      React.createElement("Text", null, "Google Sign In")
    );
  };
});

jest.mock("../../../components/buttons/FacebookSignInButton", () => {
  const React = require("react");
  return function MockFacebookSignInButton({ onPress, disabled }: any) {
    return React.createElement(
      "View",
      {
        testID: "facebook-signin-button",
        onPress: onPress,
        "data-disabled": disabled,
      },
      React.createElement("Text", null, "Facebook Sign In")
    );
  };
});

jest.mock("../../../components/buttons/TwitterSignInButton", () => {
  const React = require("react");
  return function MockTwitterSignInButton({ onPress, disabled }: any) {
    return React.createElement(
      "View",
      {
        testID: "twitter-signin-button",
        onPress: onPress,
        "data-disabled": disabled,
      },
      React.createElement("Text", null, "X Sign In")
    );
  };
});

jest.mock("../../../components/layouts/CustomSafeAreaView", () => {
  const React = require("react");
  return function MockCustomSafeAreaView({ children }: any) {
    return React.createElement(
      "View",
      { testID: "custom-safe-area-view" },
      children
    );
  };
});

jest.mock("../../../components/layouts/AuthLayout", () => {
  const React = require("react");
  return function MockAuthLayout({ children }: any) {
    return React.createElement("View", { testID: "auth-layout" }, children);
  };
});

jest.mock("../../../components/text/ScreenTitle", () => {
  const React = require("react");
  return function MockScreenTitle({ title }: any) {
    return React.createElement("View", {
      testID: "screen-title",
      "data-title": title,
    });
  };
});

jest.mock("../../../components/text/Error", () => {
  const React = require("react");
  return function MockError({ message }: any) {
    return React.createElement("View", {
      testID: "error-message",
      "data-message": message,
    });
  };
});

jest.mock("../../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  return function MockPulsingSpinner({ visible, size }: any) {
    return React.createElement("View", {
      testID: "pulsing-spinner",
      "data-visible": visible,
      "data-size": size,
    });
  };
});

jest.mock("../../../components/background/StarryBackground", () => {
  const React = require("react");
  return function MockStarryBackground() {
    return React.createElement("View", { testID: "starry-background" });
  };
});

// Mock constants
jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    Navigation: {
      LOGIN: "Login",
      SIGN_UP: "SignUp",
      FORGOT_PASSWORD: "ForgotPassword",
    },
    AuthStrings: {
      Login: {
        TITLE: "Log in",
        FORGOT_PASSWORD: "Forgot password?",
        LOGIN_BUTTON: "Log In",
        NO_ACCOUNT_PROMPT: "Don't have an account? ",
        REGISTER_NOW: "Register Now",
        OR_LOGIN_WITH: "Or login with",
        USER_NOT_FOUND_ERROR: "User not found. Please check your email.",
        WRONG_PASSWORD_ERROR: "Incorrect password. Please try again.",
        INVALID_EMAIL_FORMAT_ERROR: "Invalid email format",
        USER_DISABLED_ERROR: "This account has been disabled.",
        ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
          "Account exists with different credential.",
        OPERATION_NOT_SUPPORTED_ERROR: "Operation not supported.",
        LOGIN_FAILED_GENERIC: "Login failed. Please check your credentials.",
      },
    },
  },
}));

jest.mock("../../../constants/loading", () => ({
  LOADING_SPINNER_SIZE: 120,
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    forgotPasswordText: { fontSize: 14 },
  },
  COLORS: { black: "#000000", white: "#FFFFFF" },
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: { sm: 14, base: 16, lg: 18, title: 24 },
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
}));

// Mock responsive utils
jest.mock("../../../utils/responsive", () => ({
  verticalScale: jest.fn((size) => size),
}));

// Mock validation
jest.mock("../../../validation/authSchemas", () => ({
  loginSchema: {
    parse: jest.fn(),
  },
  LoginFormData: {},
}));

const mockLoginWithEmail = AuthService.loginWithEmail as jest.MockedFunction<
  typeof AuthService.loginWithEmail
>;
const mockSignInWithGoogle = AuthService.signInWithGoogle as jest.MockedFunction<
  typeof AuthService.signInWithGoogle
>;
const mockSignInWithFacebook =
  AuthService.signInWithFacebook as jest.MockedFunction<
    typeof AuthService.signInWithFacebook
  >;
const mockSignInWithTwitter =
  AuthService.signInWithTwitter as jest.MockedFunction<
    typeof AuthService.signInWithTwitter
  >;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("LoginScreen", () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn(),
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as any);
    mockLoginWithEmail.mockResolvedValue(undefined as any);
    mockSignInWithGoogle.mockResolvedValue({ user: { uid: "123" } } as any);
    mockSignInWithFacebook.mockResolvedValue({ user: { uid: "123" } } as any);
    mockSignInWithTwitter.mockResolvedValue({ user: { uid: "123" } } as any);
  });

  describe("Component Rendering", () => {
    it("should render all main components", () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      expect(getByTestId("custom-safe-area-view")).toBeTruthy();
      expect(getByTestId("starry-background")).toBeTruthy();
      expect(getByTestId("auth-layout")).toBeTruthy();
      expect(getByTestId("back-button")).toBeTruthy();
      expect(getByTestId("screen-title")).toBeTruthy();
      expect(getByTestId("user-email-input")).toBeTruthy();
      expect(getByTestId("user-password-input")).toBeTruthy();
      expect(getByTestId("wide-button")).toBeTruthy();
      expect(getByTestId("pulsing-spinner")).toBeTruthy();
    });

    it("should render screen title with correct text", () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const title = getByTestId("screen-title");
      expect(title.props["data-title"]).toBe("Log in");
    });

    it("should render login button with correct text", () => {
      const { getByText } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      expect(getByText("Log In")).toBeTruthy();
    });

    it("should render spinner initially hidden", () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(false);
    });

    it("should render social sign-in buttons", () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      expect(getByTestId("google-signin-button")).toBeTruthy();
      expect(getByTestId("facebook-signin-button")).toBeTruthy();
      expect(getByTestId("twitter-signin-button")).toBeTruthy();
    });
  });

  describe("Email Input", () => {
    it("should handle email input changes", async () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );
      const emailInput = getByTestId("user-email-input");
      fireEvent.changeText(emailInput, "test@example.com");

      await waitFor(() => {
        expect(getByTestId("user-email-input").props.value).toBe(
          "test@example.com"
        );
      });
    });
  });

  describe("Password Input", () => {
    it("should handle password input changes", async () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );
      const passwordInput = getByTestId("user-password-input");
      fireEvent.changeText(passwordInput, "password123");

      await waitFor(() => {
        expect(getByTestId("user-password-input").props.value).toBe(
          "password123"
        );
      });
    });
  });

  describe("Login Flow", () => {
    it("should handle successful email login", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockResolvedValue(undefined as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const emailInput = getByTestId("user-email-input");
      const passwordInput = getByTestId("user-password-input");
      const loginButton = getByTestId("wide-button");

      fireEvent.changeText(emailInput, "test@example.com");
      fireEvent.changeText(passwordInput, "password123");
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLoginWithEmail).toHaveBeenCalledWith(
          "test@example.com",
          "password123"
        );
      });
    });

    it("should handle login validation error", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      const { ZodError } = require("zod");
      loginSchema.parse.mockImplementation(() => {
        const error = new ZodError([
          {
            code: "too_small",
            minimum: 1,
            type: "string",
            inclusive: true,
            message: "Email is required",
            path: ["email"],
          },
        ]);
        throw error;
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLoginWithEmail).not.toHaveBeenCalled();
      });
    });

    it("should handle user not found error", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue({
        code: "auth/user-not-found",
        message: "User not found",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const emailInput = getByTestId("user-email-input");
      const passwordInput = getByTestId("user-password-input");
      const loginButton = getByTestId("wide-button");

      fireEvent.changeText(emailInput, "notfound@example.com");
      fireEvent.changeText(passwordInput, "password123");
      fireEvent.press(loginButton);

      await waitFor(() => {
        const emailInputField = getByTestId("user-email-input");
        expect(emailInputField.props["data-error"]).toBe(
          "User not found. Please check your email."
        );
      });
    });

    it("should handle wrong password error", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue({
        code: "auth/wrong-password",
        message: "Wrong password",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const emailInput = getByTestId("user-email-input");
      const passwordInput = getByTestId("user-password-input");
      const loginButton = getByTestId("wide-button");

      fireEvent.changeText(emailInput, "test@example.com");
      fireEvent.changeText(passwordInput, "wrongpassword");
      fireEvent.press(loginButton);

      await waitFor(() => {
        const passwordInputField = getByTestId("user-password-input");
        expect(passwordInputField.props["data-error"]).toBe(
          "Incorrect password. Please try again."
        );
      });
    });

    it("should handle user disabled error", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue({
        code: "auth/user-disabled",
        message: "User disabled",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "This account has been disabled."
        );
      });
    });
  });

  describe("Social Sign-In", () => {
    it("should handle Google sign-in success", async () => {
      mockSignInWithGoogle.mockResolvedValue({ user: { uid: "google123" } } as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should handle Google sign-in failure", async () => {
      mockSignInWithGoogle.mockRejectedValue({
        code: "auth/account-exists-with-different-credential",
        message: "Account exists",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Account exists with different credential."
        );
      });
    });

    it("should handle Facebook sign-in success", async () => {
      mockSignInWithFacebook.mockResolvedValue({
        user: { uid: "facebook123" },
      } as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(mockSignInWithFacebook).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should handle Facebook sign-in cancellation", async () => {
      mockSignInWithFacebook.mockRejectedValue(
        new Error("User cancelled the login process")
      );

      const { getByTestId, queryByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(mockSignInWithFacebook).toHaveBeenCalled();
        // No error should be shown for cancellation
        expect(queryByTestId("error-message")).toBeNull();
      });
    });

    it("should handle Twitter sign-in success", async () => {
      mockSignInWithTwitter.mockResolvedValue({
        user: { uid: "twitter123" },
      } as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const twitterButton = getByTestId("twitter-signin-button");
      fireEvent.press(twitterButton);

      await waitFor(() => {
        expect(mockSignInWithTwitter).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("handles Twitter account-exists error", async () => {
      mockSignInWithTwitter.mockRejectedValue({
        code: "auth/account-exists-with-different-credential",
        message: "exists",
      });
      const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
      fireEvent.press(getByTestId("twitter-signin-button"));

      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "Account exists with different credential."
        );
      });
    });

    it("handles Twitter cancelled popup without showing error", async () => {
      mockSignInWithTwitter.mockRejectedValue({
        code: "auth/cancelled-popup-request",
        message: "cancelled",
      });
      const { getByTestId, queryByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );
      fireEvent.press(getByTestId("twitter-signin-button"));

      await waitFor(() => {
        expect(mockSignInWithTwitter).toHaveBeenCalled();
      });
      expect(queryByTestId("error-message")).toBeNull();
    });

    it("handles Twitter generic error", async () => {
      mockSignInWithTwitter.mockRejectedValue({
        code: "auth/unknown-error",
        message: "twitter generic",
      });
      const { getByTestId } = render(<LoginScreen navigation={mockNavigation} />);
      fireEvent.press(getByTestId("twitter-signin-button"));

      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "twitter generic"
        );
      });
    });

  });

  describe("Navigation", () => {
    it("should navigate to forgot password screen", () => {
      const { getByText } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const forgotPasswordLink = getByText("Forgot password?");
      fireEvent.press(forgotPasswordLink);

      expect(mockNavigate).toHaveBeenCalledWith("ForgotPassword");
    });

    it("should navigate to sign up screen", () => {
      const { getByText } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const registerLink = getByText("Register Now");
      fireEvent.press(registerLink);

      expect(mockNavigate).toHaveBeenCalledWith("SignUp");
    });

    it("should pass navigation prop to back button", () => {
      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const backButton = getByTestId("back-button");
      expect(backButton.props["data-navigation"]).toBe(mockNavigation);
    });
  });

  describe("Loading States", () => {
    it("should show spinner during login", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockLoginWithEmail.mockReturnValue(promise as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        const spinner = getByTestId("pulsing-spinner");
        expect(spinner.props["data-visible"]).toBe(true);
      });

      await waitFor(() => {
        const button = getByTestId("wide-button");
        expect(button.props["data-disabled"]).toBe(true);
      });

      resolvePromise!();
      await waitFor(() => {
        const finalSpinner = getByTestId("pulsing-spinner");
        expect(finalSpinner.props["data-visible"]).toBe(false);
      });
    });

    it("should disable social buttons during loading", async () => {
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockSignInWithGoogle.mockReturnValue(promise as any);

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(getByTestId("google-signin-button").props["data-disabled"]).toBe(
          true
        );
        expect(getByTestId("facebook-signin-button").props["data-disabled"]).toBe(
          true
        );
        expect(getByTestId("twitter-signin-button").props["data-disabled"]).toBe(
          true
        );
      });

      resolvePromise!();
    });
  });

  describe("Error Handling", () => {
    it("should clear errors when email input changes", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue({
        code: "auth/user-not-found",
        message: "User not found",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByTestId("user-email-input").props["data-error"]).toBeTruthy();
      });

      const emailInput = getByTestId("user-email-input");
      fireEvent.changeText(emailInput, "newemail@example.com");

      await waitFor(() => {
        expect(getByTestId("user-email-input").props["data-error"]).toBe("");
      });
    });

    it("should clear errors when password input changes", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue({
        code: "auth/wrong-password",
        message: "Wrong password",
      });

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByTestId("user-password-input").props["data-error"]).toBeTruthy();
      });

      const passwordInput = getByTestId("user-password-input");
      fireEvent.changeText(passwordInput, "newpassword");

      await waitFor(() => {
        expect(getByTestId("user-password-input").props["data-error"]).toBe("");
      });
    });

    it("should handle generic login errors", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      mockLoginWithEmail.mockRejectedValue(new Error("Network error"));

      const { getByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const loginButton = getByTestId("wide-button");
      fireEvent.press(loginButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Login failed. Please check your credentials."
        );
      });
    });

    it("handles invalid email and default firebase login errors", async () => {
      const { loginSchema } = require("../../../validation/authSchemas");
      loginSchema.parse.mockReturnValue(undefined);
      const { getByTestId, rerender } = render(<LoginScreen navigation={mockNavigation} />);

      mockLoginWithEmail.mockRejectedValueOnce({
        code: "auth/invalid-email",
        message: "invalid",
      });
      fireEvent.press(getByTestId("wide-button"));
      await waitFor(() => {
        expect(getByTestId("user-email-input").props["data-error"]).toBe(
          "Invalid email format"
        );
      });

      mockLoginWithEmail.mockRejectedValueOnce({
        code: "auth/other",
        message: "fallback message",
      });
      rerender(<LoginScreen navigation={mockNavigation} />);
      fireEvent.press(getByTestId("wide-button"));
      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "fallback message"
        );
      });
    });
  });

  describe("Component Integration", () => {
    it("should render without crashing", () => {
      expect(() => {
        render(<LoginScreen navigation={mockNavigation} />);
      }).not.toThrow();
    });

    it("should initialize with correct default state", () => {
      const { getByTestId, queryByTestId } = render(
        <LoginScreen navigation={mockNavigation} />
      );

      const emailInput = getByTestId("user-email-input");
      expect(emailInput.props.value).toBe("");

      const passwordInput = getByTestId("user-password-input");
      expect(passwordInput.props.value).toBe("");

      expect(queryByTestId("error-message")).toBeNull();

      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(false);
    });
  });
});
