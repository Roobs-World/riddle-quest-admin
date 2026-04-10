import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LandingScreen from "../LandingScreen";
jest.unmock("../LandingScreen"); // Explicitly unmock to ensure coverage
import { AuthService } from "../../services/AuthService";
import { useAuth } from "../../contexts/AuthContext";
import { ModalProvider } from "../../contexts/ModalContext";

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
jest.mock("../../services/AuthService", () => ({
  AuthService: {
    signInWithGoogle: jest.fn(),
    signInWithFacebook: jest.fn(),
  },
}));

// Mock useAuth hook
const mockLogin = jest.fn();
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

// Mock components
jest.mock("../../components/layouts/CustomSafeAreaView", () => {
  const React = require("react");
  return function MockCustomSafeAreaView({ children }: any) {
    return React.createElement(
      "View",
      { testID: "custom-safe-area-view" },
      children
    );
  };
});

jest.mock("../../components/buttons/GoogleSignInButton", () => {
  const React = require("react");
  return function MockGoogleSignInButton({ onPress, disabled }: any) {
    return React.createElement("View", {
      testID: "google-signin-button",
      onPress: disabled ? undefined : onPress,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/buttons/FacebookSignInButton", () => {
  const React = require("react");
  return function MockFacebookSignInButton({ onPress, disabled }: any) {
    return React.createElement("View", {
      testID: "facebook-signin-button",
      onPress: disabled ? undefined : onPress,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({ buttonText, onPress, disabled }: any) {
    return React.createElement("View", {
      testID: "wide-button",
      onPress: disabled ? undefined : onPress,
      "data-text": buttonText,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/buttons/SignUpButton", () => {
  const React = require("react");
  return function MockSignUpButton({ onPress }: any) {
    return React.createElement("View", {
      testID: "sign-up-button",
      onPress: onPress,
    });
  };
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  return function MockPulsingSpinner({ visible, size }: any) {
    return React.createElement("View", {
      testID: "pulsing-spinner",
      "data-visible": visible,
      "data-size": size,
    });
  };
});

jest.mock("../../components/text/Subtitle", () => {
  const React = require("react");
  return function MockSubtitle({ text }: any) {
    return React.createElement("View", {
      testID: "subtitle",
      "data-text": text,
    });
  };
});

jest.mock("../../components/text/Error", () => {
  const React = require("react");
  return function MockError({ message }: any) {
    return React.createElement("View", {
      testID: "error-message",
      "data-message": message,
    });
  };
});

jest.mock("../../components/background/StarryBackground", () => {
  const React = require("react");
  return function MockStarryBackground() {
    return React.createElement("View", { testID: "starry-background" });
  };
});

// Mock HomeBgSvg
jest.mock("../../../assets/images/home-bg.svg", () => {
  const React = require("react");
  return function MockHomeBgSvg(props: any) {
    return React.createElement("View", {
      testID: "home-bg-svg",
      "data-width": props.width,
      "data-height": props.height,
    });
  };
});

// Mock constants
jest.mock("../../constants/AppStrings", () => ({
  AppStrings: {
    AuthStrings: {
      Landing: {
        TAGLINE_1: "Test Tagline 1",
        TAGLINE_2: "Test Tagline 2",
        SIGN_IN_BUTTON: "Sign In",
        OR_SIGN_IN_WITH: "Or sign in with",
        NO_ACCOUNT_PROMPT: "No account?",
      },
    },
    Navigation: {
      LOGIN: "Login",
      SIGN_UP: "SignUp",
      CREDITS: "Credits",
    },
  },
}));

// Mock styles
jest.mock("../../styles", () => ({
  styles: {
    backgroundImage: { position: "absolute" },
    title: { fontSize: 24 },
    separatorText: { fontSize: 14 },
    creditsLink: { fontSize: 12 },
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

const TestWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <ModalProvider>{children}</ModalProvider>
);

const renderWithProviders = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: TestWrapper,
  });

describe.skip("LandingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
    });
  });

  describe("Component Rendering", () => {
    it("should render all main components", () => {
      const { getAllByTestId, getByTestId, getByText } = renderWithProviders(
        <LandingScreen />
      );

      expect(getByTestId("custom-safe-area-view")).toBeTruthy();
      expect(getByTestId("home-bg-svg")).toBeTruthy();
      expect(getAllByTestId("wide-button").length).toBeGreaterThanOrEqual(1);
      expect(getByTestId("google-signin-button")).toBeTruthy();
      expect(getByTestId("facebook-signin-button")).toBeTruthy();
      expect(getByTestId("sign-up-button")).toBeTruthy();
      expect(getByTestId("pulsing-spinner")).toBeTruthy();
      expect(getByText("Test Tagline 1")).toBeTruthy();
      expect(getByText("Credits")).toBeTruthy();
    });

    it("should render subtitle component with correct text", () => {
      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const subtitle = getByTestId("subtitle");
      expect(subtitle.props["data-text"]).toBe("Test Tagline 2");
    });

    it("should render wide button with correct text", () => {
      const { getAllByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const wideButtons = getAllByTestId("wide-button");
      const signInButton = wideButtons.find(
        (btn: any) => btn.props["data-text"] === "Sign In"
      );
      expect(signInButton).toBeTruthy();
      expect(signInButton!.props["data-disabled"]).toBe(false);
    });

    it("should render spinner as not visible initially", () => {
      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(false);
      expect(spinner.props["data-size"]).toBe(120);
    });
  });

  describe("Navigation", () => {
    it("should navigate to login when sign in button is pressed", () => {
      const { getAllByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const wideButtons = getAllByTestId("wide-button");
      const signInButton = wideButtons.find(
        (btn: any) => btn.props["data-text"] === "Sign In"
      );
      fireEvent.press(signInButton!);

      expect(mockNavigate).toHaveBeenCalledWith("Login");
    });

    it("should navigate to sign up when sign up button is pressed", () => {
      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const signUpButton = getByTestId("sign-up-button");
      fireEvent.press(signUpButton);

      expect(mockNavigate).toHaveBeenCalledWith("SignUp");
    });

    it("should navigate to credits when credits link is pressed", () => {
      const { getByText } = renderWithProviders(
        <LandingScreen />
      );

      const creditsLink = getByText("Credits");
      fireEvent.press(creditsLink);

      expect(mockNavigate).toHaveBeenCalledWith("Credits");
    });
  });

  describe("Google Sign In", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
      mockSignInWithGoogle.mockClear();
      mockLogin.mockClear();
    });

    it("should call Google sign in and login on success", async () => {
      const mockUserCredential = {
        user: { uid: "test-uid" },
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(AuthService.signInWithGoogle).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should show loading spinner during Google sign in", async () => {
      (AuthService.signInWithGoogle as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // stays pending; no timer leak
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      // Should show loading
      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(true);
    });

    it("should handle Google sign in account exists error", async () => {
      const error = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Account exists with different credential. Please use a different login method."
        );
      });
    });

    it("should handle Google sign in popup closed error", async () => {
      const error = {
        code: "auth/auth-popup-closed-by-user",
        message: "Popup closed",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByTestId, queryByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        // Should not show error for popup closed
        expect(queryByTestId("error-message")).toBeFalsy();
      });
    });

    it("should handle generic Google sign in error", async () => {
      const error = {
        code: "auth/unknown-error",
        message: "Unknown error occurred",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Unknown error occurred"
        );
      });
    });
  });

  describe("Facebook Sign In", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
      mockSignInWithFacebook.mockClear();
      mockLogin.mockClear();
    });

    it("should call Facebook sign in and login on success", async () => {
      const mockUserCredential = {
        user: { uid: "test-uid" },
      };
      (AuthService.signInWithFacebook as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(AuthService.signInWithFacebook).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should show loading spinner during Facebook sign in", async () => {
      (AuthService.signInWithFacebook as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // stays pending; no timer leak
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      // Should show loading
      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(true);
    });

    it("should handle Facebook sign in account exists error", async () => {
      const error = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists",
      };
      (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Account exists with different credential. Please use a different login method."
        );
      });
    });

    it("should handle Facebook sign in not supported error", async () => {
      const error = {
        code: "auth/operation-not-supported-in-this-environment",
        message: "Not supported",
      };
      (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "Facebook login is not supported in this environment."
        );
      });
    });

    it("should handle Facebook sign-in failure with generic error", async () => {
      const errorMessage =
        "An unexpected error occurred during Facebook login.";
      (AuthService.signInWithFacebook as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage)
      );
      const { getByTestId, findByTestId } = renderWithProviders(
        <LandingScreen />
      );

      fireEvent.press(getByTestId("facebook-signin-button"));

      await waitFor(() => {
        expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1);
        expect(mockLogin).not.toHaveBeenCalled();
      });

      const errorComponent = await findByTestId("error-message");
      expect(errorComponent.props["data-message"]).toBe(errorMessage);
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    });
  });

  describe("Loading States", () => {
    it("should disable buttons when loading", async () => {
      (AuthService.signInWithGoogle as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // stays pending; no timer leak
      );

      const { getAllByTestId, getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      const wideButtons = getAllByTestId("wide-button");
      const signInButton = wideButtons.find(
        (btn: any) => btn.props["data-text"] === "Sign In"
      );
      const facebookButton = getByTestId("facebook-signin-button");

      expect(signInButton!.props["data-disabled"]).toBe(true);
      expect(googleButton.props["data-disabled"]).toBe(true);
      expect(facebookButton.props["data-disabled"]).toBe(true);
    });

    it("should hide spinner after successful authentication", async () => {
      const mockUserCredential = {
        user: { uid: "test-uid" },
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const spinner = getByTestId("pulsing-spinner");
        expect(spinner.props["data-visible"]).toBe(false);
      });
    });

    it("should hide spinner after authentication error", async () => {
      const error = {
        code: "auth/unknown-error",
        message: "Error occurred",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const spinner = getByTestId("pulsing-spinner");
        expect(spinner.props["data-visible"]).toBe(false);
      });
    });
  });

  describe("Error Handling", () => {
    it("should clear previous errors when starting new authentication", async () => {
      // First, create an error
      const error = {
        code: "auth/unknown-error",
        message: "First error",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe("First error");
      });

      // Now try Facebook sign in - should clear the error
      (AuthService.signInWithFacebook as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // stays pending; no timer leak
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      // Error should be cleared (component won't render error component)
      expect(() => getByTestId("error-message")).toThrow();
    });

    it("should not show error message when no error exists", () => {
      const { queryByTestId } = renderWithProviders(
        <LandingScreen />
      );

      expect(queryByTestId("error-message")).toBeFalsy();
    });
  });

  describe("State Management", () => {
    it("should handle authentication without uid", async () => {
      const mockUserCredential = {
        user: { uid: null },
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(AuthService.signInWithGoogle).toHaveBeenCalled();
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it("should handle useAuth hook correctly", () => {
      expect(() =>
        renderWithProviders(<LandingScreen />)
      ).not.toThrow();
      expect(useAuth).toHaveBeenCalled();
    });
  });

  describe("Text Content", () => {
    it("should display correct separator texts", () => {
      const { getByText } = renderWithProviders(
        <LandingScreen />
      );

      expect(getByText("Or sign in with")).toBeTruthy();
      expect(getByText("No account?")).toBeTruthy();
    });

    it("should display taglines from constants", () => {
      const { getByText } = renderWithProviders(
        <LandingScreen />
      );

      expect(getByText("Test Tagline 1")).toBeTruthy();
    });
  });

  describe("Component Integration", () => {
    it("should pass correct props to all components", () => {
      const { getByTestId } = renderWithProviders(
        <LandingScreen />
      );

      // Check background SVG props
      const bgSvg = getByTestId("home-bg-svg");
      expect(bgSvg.props["data-width"]).toBe("120%");
      expect(bgSvg.props["data-height"]).toBe("100%");

      // Check spinner props
      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-size"]).toBe(120);
      expect(spinner.props["data-visible"]).toBe(false);
    });
  });
});

// Typed mocks for AuthService methods
const mockSignInWithGoogle =
  AuthService.signInWithGoogle as jest.MockedFunction<
    typeof AuthService.signInWithGoogle
  >;
const mockSignInWithFacebook =
  AuthService.signInWithFacebook as jest.MockedFunction<
    typeof AuthService.signInWithFacebook
  >;

describe.skip("Google Sign-In", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
    mockSignInWithGoogle.mockClear();
    mockLogin.mockClear();
  });

  it("should handle successful Google sign-in", async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({
      user: { uid: "test-uid" },
    } as any);
    const { getByTestId } = renderWithProviders(
      <LandingScreen />
    );

    const googleButton = getByTestId("google-signin-button");
    fireEvent.press(googleButton);

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(googleButton.props["data-disabled"]).toBe(true);

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    expect(getByTestId("google-signin-button").props["data-disabled"]).toBe(
      false
    );
  });

  it("should handle Google sign-in failure with generic error", async () => {
    const errorMessage = "Network error";
    mockSignInWithGoogle.mockRejectedValueOnce(new Error(errorMessage));
    const { getByTestId, findByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(errorMessage);
    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
  });

  it("should handle Google sign-in failure with 'auth/account-exists-with-different-credential'", async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: "auth/account-exists-with-different-credential",
    });
    const { getByTestId, findByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "Account exists with different credential. Please use a different login method."
    );
  });

  it("should handle Google sign-in failure with 'auth/auth-popup-closed-by-user'", async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: "auth/auth-popup-closed-by-user",
    });
    // Spy on console.log for this specific test
    const consoleSpy = jest.spyOn(console, "log");

    const { getByTestId, queryByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));

    expect(queryByTestId("error-message")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("Auth popup closed by user.");
    consoleSpy.mockRestore(); // Restore console.log
  });
});

describe.skip("Facebook Sign-In", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
    mockSignInWithFacebook.mockClear();
    mockLogin.mockClear();
  });

  it("should handle successful Facebook sign-in", async () => {
    mockSignInWithFacebook.mockResolvedValueOnce({
      user: { uid: "test-uid" },
    } as any);
    const { getByTestId } = renderWithProviders(
      <LandingScreen />
    );

    const facebookButton = getByTestId("facebook-signin-button");
    fireEvent.press(facebookButton);

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);

    await waitFor(() => {
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    expect(getByTestId("facebook-signin-button").props["data-disabled"]).toBe(
      false
    );
  });

  it("should handle Facebook sign-in failure with generic error", async () => {
    const errorMessage = "An unexpected error occurred during Facebook login.";
    mockSignInWithFacebook.mockRejectedValueOnce(new Error(errorMessage));
    const { getByTestId, findByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() => {
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(errorMessage);
    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
  });

  it("should handle Facebook sign-in failure with 'auth/account-exists-with-different-credential'", async () => {
    mockSignInWithFacebook.mockRejectedValueOnce({
      code: "auth/account-exists-with-different-credential",
    });
    const { getByTestId, findByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() =>
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1)
    );

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "Account exists with different credential. Please use a different login method."
    );
  });

  it("should handle Facebook sign-in failure with 'auth/auth-popup-closed-by-user'", async () => {
    mockSignInWithFacebook.mockRejectedValueOnce({
      code: "auth/auth-popup-closed-by-user",
    });
    const consoleSpy = jest.spyOn(console, "log");
    const { getByTestId, queryByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() =>
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1)
    );

    expect(queryByTestId("error-message")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("Auth popup closed by user.");
    consoleSpy.mockRestore();
  });

  it("should handle Facebook sign-in failure with 'auth/operation-not-supported-in-this-environment'", async () => {
    mockSignInWithFacebook.mockRejectedValueOnce({
      code: "auth/operation-not-supported-in-this-environment",
    });
    const { getByTestId, findByTestId } = renderWithProviders(
      <LandingScreen />
    );

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() =>
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1)
    );

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "Facebook login is not supported in this environment."
    );
  });
});

describe.skip("Loading States and Button Disabling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
  });

  it("should disable all relevant buttons when Google sign-in is loading", async () => {
    let resolveGooglePromise: (value: any) => void;
    mockSignInWithGoogle.mockImplementationOnce(
      () => new Promise((resolve) => (resolveGooglePromise = resolve))
    );

    const { getAllByTestId, getByTestId } = renderWithProviders(
      <LandingScreen />
    );

    const googleButton = getByTestId("google-signin-button");
    const facebookButton = getByTestId("facebook-signin-button");
    const wideButtons = getAllByTestId("wide-button");
    const signInButton = wideButtons.find(
      (btn: any) => btn.props["data-text"] === "Sign In"
    );

    fireEvent.press(googleButton);

    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });

    expect(googleButton.props["data-disabled"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);
    expect(signInButton!.props["data-disabled"]).toBe(true);

    // Resolve the promise to allow cleanup
    resolveGooglePromise!({ user: { uid: "test-uid" } } as any);
    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    });
  });

  it("should disable all relevant buttons when Facebook sign-in is loading", async () => {
    let resolveFacebookPromise: (value: any) => void;
    mockSignInWithFacebook.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFacebookPromise = resolve))
    );

    const { getAllByTestId, getByTestId } = renderWithProviders(
      <LandingScreen />
    );

    const googleButton = getByTestId("google-signin-button");
    const facebookButton = getByTestId("facebook-signin-button");
    const wideButtons = getAllByTestId("wide-button");
    const signInButton = wideButtons.find(
      (btn: any) => btn.props["data-text"] === "Sign In"
    );

    fireEvent.press(facebookButton);

    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });

    expect(googleButton.props["data-disabled"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);
    expect(signInButton!.props["data-disabled"]).toBe(true);

    // Resolve the promise to allow cleanup
    resolveFacebookPromise!({ user: { uid: "test-uid" } } as any);
    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
    });
  });
});
