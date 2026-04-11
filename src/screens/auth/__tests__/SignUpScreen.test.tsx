import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SignUpScreen from "../SignUpScreen";
import { AuthService } from "../../../services/AuthService";

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
    signUpWithEmail: jest.fn(),
  },
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

// Mock Linking
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(undefined),
}));

// Mock Alert
jest.mock("react-native/Libraries/Alert/Alert", () => ({
  alert: jest.fn(),
}));

// Mock components
jest.mock("../../../components/inputFields/UserUsernameInput", () => {
  const React = require("react");
  return function MockUserUsernameInput({
    username,
    setUsername,
    errorMessage,
  }: any) {
    return React.createElement("TextInput", {
      testID: "user-username-input",
      onChangeText: setUsername,
      value: username,
      "data-error": errorMessage,
    });
  };
});

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
    placeholder,
    label,
  }: any) {
    return React.createElement("TextInput", {
      testID: label?.includes("Confirm")
        ? "user-confirm-password-input"
        : "user-password-input",
      onChangeText: setPassword,
      value: password,
      "data-error": errorMessage,
      "data-placeholder": placeholder,
      "data-label": label,
    });
  };
});

jest.mock("../../../components/shared/ProgressBar", () => {
  const React = require("react");
  return function MockProgressBar({ activeStep, totalSteps }: any) {
    return React.createElement("View", {
      testID: "progress-bar",
      "data-active-step": activeStep,
      "data-total-steps": totalSteps,
    });
  };
});

jest.mock("../../../components/icons/CheckboxIcon", () => {
  const React = require("react");
  return function MockCheckboxIcon({ checked }: any) {
    return React.createElement("View", {
      testID: "checkbox-icon",
      "data-checked": checked,
    });
  };
});

jest.mock("../../../components/text/PasswordMatch", () => {
  const React = require("react");
  return function MockPasswordMatch({
    passwordsMatch,
    isPasswordLongEnough,
  }: any) {
    return React.createElement("View", {
      testID: "password-match",
      "data-passwords-match": passwordsMatch,
      "data-is-password-long-enough": isPasswordLongEnough,
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

jest.mock("../../../components/layouts/CustomSafeAreaView", () => {
  const React = require("react");
  return function MockCustomSafeAreaView({ children, style }: any) {
    return React.createElement(
      "View",
      { testID: "custom-safe-area-view", style },
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
    },
    AuthStrings: {
      SignUp: {
        TITLE: "Create your account",
        CONFIRM_PASSWORD_PLACEHOLDER: "Confirm your password",
        CONFIRM_PASSWORD_LABEL: "Confirm Password",
        TERMS_AGREEMENT_PART1: "I agree to the ",
        TERMS_USER_AGREEMENT: "user agreement",
        TERMS_AGREEMENT_PART2: " and ",
        TERMS_PRIVACY_POLICY: "privacy policy",
        NEXT_BUTTON: "Next",
        HAS_ACCOUNT_PROMPT: "Do you have an account? ",
        LOGIN_NOW: "Log in now",
        EMAIL_ALREADY_IN_USE_ERROR: "This email address is already in use.",
        INVALID_EMAIL_ERROR: "The email address is invalid.",
        OPERATION_NOT_ALLOWED_ERROR:
          "Email and password sign-up is not enabled.",
        WEAK_PASSWORD_ERROR: "The password is too weak.",
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
    signUpContainer: { flex: 1 },
    signUpSafeArea: { flex: 1 },
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
  signUpSchema: {
    parse: jest.fn(),
    safeParse: jest.fn(() => ({ success: true })),
  },
  SignUpFormData: {},
}));

const mockSignUpWithEmail = AuthService.signUpWithEmail as jest.MockedFunction<
  typeof AuthService.signUpWithEmail
>;

describe("SignUpScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUpWithEmail.mockResolvedValue(undefined as any);
  });

  describe("Component Rendering", () => {
    it("should render all main components", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      expect(getByTestId("starry-background")).toBeTruthy();
      expect(getByTestId("custom-safe-area-view")).toBeTruthy();
      expect(getByTestId("auth-layout")).toBeTruthy();
      expect(getByTestId("back-button")).toBeTruthy();
      expect(getByTestId("screen-title")).toBeTruthy();
      expect(getByTestId("progress-bar")).toBeTruthy();
      expect(getByTestId("user-username-input")).toBeTruthy();
      expect(getByTestId("user-email-input")).toBeTruthy();
      expect(getByTestId("user-password-input")).toBeTruthy();
      expect(getByTestId("user-confirm-password-input")).toBeTruthy();
      expect(getByTestId("checkbox-icon")).toBeTruthy();
      expect(getByTestId("wide-button")).toBeTruthy();
      expect(getByTestId("pulsing-spinner")).toBeTruthy();
    });

    it("should render screen title with correct text", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const title = getByTestId("screen-title");
      expect(title.props["data-title"]).toBe("Create your account");
    });

    it("should render next button with correct text", () => {
      const { getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      expect(getByText("Next")).toBeTruthy();
    });

    it("should render spinner initially hidden", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(false);
    });

    it("should render progress bar with initial state", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const progressBar = getByTestId("progress-bar");
      expect(progressBar.props["data-active-step"]).toBe(0);
      expect(progressBar.props["data-total-steps"]).toBe(3);
    });

    it("should render checkbox initially unchecked", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const checkbox = getByTestId("checkbox-icon");
      expect(checkbox.props["data-checked"]).toBe(false);
    });
  });

  describe("Form Input", () => {
    it("should handle username input changes", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );
      const usernameInput = getByTestId("user-username-input");
      fireEvent.changeText(usernameInput, "testuser");

      await waitFor(() => {
        expect(getByTestId("user-username-input").props.value).toBe("testuser");
      });
    });

    it("should handle email input changes", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );
      const emailInput = getByTestId("user-email-input");
      fireEvent.changeText(emailInput, "test@example.com");

      await waitFor(() => {
        expect(getByTestId("user-email-input").props.value).toBe(
          "test@example.com"
        );
      });
    });

    it("should handle password input changes", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );
      const passwordInput = getByTestId("user-password-input");
      fireEvent.changeText(passwordInput, "password123");

      await waitFor(() => {
        expect(getByTestId("user-password-input").props.value).toBe(
          "password123"
        );
      });
    });

    it("should handle confirm password input changes", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );
      const confirmPasswordInput = getByTestId("user-confirm-password-input");
      fireEvent.changeText(confirmPasswordInput, "password123");

      await waitFor(() => {
        expect(getByTestId("user-confirm-password-input").props.value).toBe(
          "password123"
        );
      });
    });
  });

  describe("Password Matching", () => {
    it("should show password match component when confirm password has input", async () => {
      const { getByTestId, queryByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Initially password match should not be visible
      expect(queryByTestId("password-match")).toBeNull();

      // Enter confirm password
      const confirmPasswordInput = getByTestId("user-confirm-password-input");
      fireEvent.changeText(confirmPasswordInput, "p");

      await waitFor(() => {
        expect(getByTestId("password-match")).toBeTruthy();
      });
    });

    it("should indicate passwords match when they are the same", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const passwordInput = getByTestId("user-password-input");
      const confirmPasswordInput = getByTestId("user-confirm-password-input");

      fireEvent.changeText(passwordInput, "password123");
      fireEvent.changeText(confirmPasswordInput, "password123");

      await waitFor(() => {
        const passwordMatch = getByTestId("password-match");
        expect(passwordMatch.props["data-passwords-match"]).toBe(true);
        expect(passwordMatch.props["data-is-password-long-enough"]).toBe(true);
      });
    });

    it("should indicate passwords do not match when they differ", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const passwordInput = getByTestId("user-password-input");
      const confirmPasswordInput = getByTestId("user-confirm-password-input");

      fireEvent.changeText(passwordInput, "password123");
      fireEvent.changeText(confirmPasswordInput, "password456");

      await waitFor(() => {
        const passwordMatch = getByTestId("password-match");
        expect(passwordMatch.props["data-passwords-match"]).toBe(false);
      });
    });

    it("should indicate password is not long enough when less than 6 chars", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const passwordInput = getByTestId("user-password-input");
      const confirmPasswordInput = getByTestId("user-confirm-password-input");

      fireEvent.changeText(passwordInput, "pass");
      fireEvent.changeText(confirmPasswordInput, "pass");

      await waitFor(() => {
        const passwordMatch = getByTestId("password-match");
        expect(passwordMatch.props["data-is-password-long-enough"]).toBe(false);
      });
    });
  });

  describe("Terms Agreement", () => {
    it("should toggle terms agreement when checkbox is pressed", async () => {
      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const checkbox = getByTestId("checkbox-icon");
      expect(checkbox.props["data-checked"]).toBe(false);

      // Find and press the terms agreement touchable area
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      await waitFor(() => {
        expect(getByTestId("checkbox-icon").props["data-checked"]).toBe(true);
      });

      // Press again to toggle off
      fireEvent.press(termsText);

      await waitFor(() => {
        expect(getByTestId("checkbox-icon").props["data-checked"]).toBe(false);
      });
    });

  });

  describe("Progress Bar Updates", () => {
    it("should update progress when form fields are filled", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in username, email, and password
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");

      await waitFor(() => {
        const progressBar = getByTestId("progress-bar");
        expect(progressBar.props["data-active-step"]).toBe(1);
      });
    });

    it("should update progress when passwords match", async () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all required fields with matching passwords
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      await waitFor(() => {
        const progressBar = getByTestId("progress-bar");
        expect(progressBar.props["data-active-step"]).toBe(2);
      });
    });

    it("should update progress to max when form is complete", async () => {
      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all required fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      await waitFor(() => {
        const progressBar = getByTestId("progress-bar");
        expect(progressBar.props["data-active-step"]).toBe(3);
      });
    });
  });

  describe("Sign Up Flow", () => {
    it("should handle successful sign up", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      mockSignUpWithEmail.mockResolvedValue(undefined as any);

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      // Press sign up
      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        expect(mockSignUpWithEmail).toHaveBeenCalledWith(
          "test@example.com",
          "password123"
        );
      });
    });

    it("should show error when terms not agreed", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields but don't agree to terms
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Update safeParse to return success but don't agree to terms
      signUpSchema.safeParse.mockReturnValue({ success: true });

      // Press sign up without agreeing to terms
      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Please agree to the terms and privacy policy."
        );
      });
    });

    it("should handle validation error", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      const { ZodError } = require("zod");
      signUpSchema.parse.mockImplementation(() => {
        const error = new ZodError([
          {
            code: "too_small",
            minimum: 1,
            type: "string",
            inclusive: true,
            message: "Username is required",
            path: ["username"],
          },
        ]);
        throw error;
      });
      signUpSchema.safeParse.mockReturnValue({ success: true });

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        expect(mockSignUpWithEmail).not.toHaveBeenCalled();
      });
    });

    it("should handle email already in use error", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      mockSignUpWithEmail.mockRejectedValue({
        code: "auth/email-already-in-use",
        message: "Email already in use",
      });

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "existing@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        expect(getByTestId("user-email-input").props["data-error"]).toBe(
          "This email address is already in use."
        );
      });
    });

    it("should handle weak password error", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      mockSignUpWithEmail.mockRejectedValue({
        code: "auth/weak-password",
        message: "Weak password",
      });

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "weak");
      fireEvent.changeText(getByTestId("user-confirm-password-input"), "weak");

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "The password is too weak."
        );
      });
    });

    it("should handle invalid email error", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      mockSignUpWithEmail.mockRejectedValue({
        code: "auth/invalid-email",
        message: "Invalid email",
      });

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(getByTestId("user-email-input"), "invalid-email");
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        expect(getByTestId("user-email-input").props["data-error"]).toBe(
          "The email address is invalid."
        );
      });
    });

    it("handles operation-not-allowed and generic firebase errors", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      const { getByTestId, getByText, rerender } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(getByTestId("user-email-input"), "test@example.com");
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(getByTestId("user-confirm-password-input"), "password123");
      fireEvent.press(getByText("I agree to the "));

      mockSignUpWithEmail.mockRejectedValueOnce({
        code: "auth/operation-not-allowed",
        message: "not allowed",
      });
      fireEvent.press(getByTestId("wide-button"));
      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "Email and password sign-up is not enabled."
        );
      });

      mockSignUpWithEmail.mockRejectedValueOnce({
        code: "auth/other",
        message: "firebase fallback",
      });
      rerender(<SignUpScreen navigation={mockNavigation} />);
      fireEvent.press(getByTestId("wide-button"));
      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "firebase fallback"
        );
      });
    });

    it("handles unknown non-firebase sign-up errors", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      mockSignUpWithEmail.mockRejectedValueOnce("unexpected");

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(getByTestId("user-email-input"), "test@example.com");
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(getByTestId("user-confirm-password-input"), "password123");
      fireEvent.press(getByText("I agree to the "));
      fireEvent.press(getByTestId("wide-button"));

      await waitFor(() => {
        expect(getByTestId("error-message").props["data-message"]).toBe(
          "An unexpected error occurred during sign up."
        );
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate to login screen when login link is pressed", () => {
      const { getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const loginLink = getByText("Log in now");
      fireEvent.press(loginLink);

      expect(mockNavigate).toHaveBeenCalledWith("Login");
    });

    it("should pass navigation prop to back button", () => {
      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const backButton = getByTestId("back-button");
      expect(backButton.props["data-navigation"]).toBe(mockNavigation);
    });
  });

  describe("Loading States", () => {
    it("should show spinner during sign up", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockSignUpWithEmail.mockReturnValue(promise as any);

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        const spinner = getByTestId("pulsing-spinner");
        expect(spinner.props["data-visible"]).toBe(true);
      });

      resolvePromise!();
      await waitFor(() => {
        const finalSpinner = getByTestId("pulsing-spinner");
        expect(finalSpinner.props["data-visible"]).toBe(false);
      });
    });

    it("should disable button during loading", async () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.parse.mockReturnValue(undefined);
      signUpSchema.safeParse.mockReturnValue({ success: true });
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockSignUpWithEmail.mockReturnValue(promise as any);

      const { getByTestId, getByText } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      // Agree to terms
      const termsText = getByText("I agree to the ");
      fireEvent.press(termsText);

      const signUpButton = getByTestId("wide-button");
      fireEvent.press(signUpButton);

      await waitFor(() => {
        expect(getByTestId("wide-button").props["data-disabled"]).toBe(true);
      });

      resolvePromise!();
    });
  });

  describe("Button Disabled State", () => {
    it("should disable button when form is incomplete", () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.safeParse.mockReturnValue({ success: false });

      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      const signUpButton = getByTestId("wide-button");
      expect(signUpButton.props["data-disabled"]).toBe(true);
    });

    it("should disable button when terms not agreed", () => {
      const { signUpSchema } = require("../../../validation/authSchemas");
      signUpSchema.safeParse.mockReturnValue({ success: true });

      const { getByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      // Fill in all fields but don't agree to terms
      fireEvent.changeText(getByTestId("user-username-input"), "testuser");
      fireEvent.changeText(
        getByTestId("user-email-input"),
        "test@example.com"
      );
      fireEvent.changeText(getByTestId("user-password-input"), "password123");
      fireEvent.changeText(
        getByTestId("user-confirm-password-input"),
        "password123"
      );

      const signUpButton = getByTestId("wide-button");
      expect(signUpButton.props["data-disabled"]).toBe(true);
    });
  });

  describe("Component Integration", () => {
    it("should render without crashing", () => {
      expect(() => {
        render(<SignUpScreen navigation={mockNavigation} />);
      }).not.toThrow();
    });

    it("should initialize with correct default state", () => {
      const { getByTestId, queryByTestId } = render(
        <SignUpScreen navigation={mockNavigation} />
      );

      expect(getByTestId("user-username-input").props.value).toBe("");
      expect(getByTestId("user-email-input").props.value).toBe("");
      expect(getByTestId("user-password-input").props.value).toBe("");
      expect(getByTestId("user-confirm-password-input").props.value).toBe("");
      expect(getByTestId("checkbox-icon").props["data-checked"]).toBe(false);
      expect(queryByTestId("error-message")).toBeNull();
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    });
  });
});
