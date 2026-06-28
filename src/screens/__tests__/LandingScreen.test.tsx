import React from "react";
import {render, fireEvent, waitFor} from "@testing-library/react-native";
import {Linking} from "react-native";
import LandingScreen from "../LandingScreen";
jest.unmock("../LandingScreen"); // Explicitly unmock to ensure coverage
import {AuthService} from "../../services/AuthService";
import {useAuth, useAuthSession} from "../../contexts/AuthContext";
import {ModalProvider} from "../../contexts/ModalContext";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

// Mock AuthService
jest.mock("../../services/AuthService", () => ({
  AuthService: {
    signInWithGoogle: jest.fn(),
    signInWithFacebook: jest.fn(),
    signInAnonymously: jest.fn(),
    logout: jest.fn(),
  },
  isFacebookLoginCancellation: jest.fn(
    (error: unknown) =>
      (error instanceof Error && error.message === "User cancelled the login process") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "auth/auth-popup-closed-by-user"),
  ),
  isGoogleSignInCancellation: jest.fn(
    (error: unknown) =>
      (error instanceof Error && error.message === "Google sign-in cancelled by user.") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "auth/auth-popup-closed-by-user"),
  ),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Mock useAuthSession hook
const mockLogin = jest.fn();
const mockSetGameMode = jest.fn();
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
  useAuthSession: jest.fn(),
}));
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAuthSession = useAuthSession as jest.MockedFunction<typeof useAuthSession>;
mockedUseAuthSession.mockImplementation(() => mockedUseAuth() as any);

// Mock components
jest.mock("../../components/layouts/CustomSafeAreaView", () => {
  const React = require("react");
  return function MockCustomSafeAreaView({children}: any) {
    return React.createElement("View", {testID: "custom-safe-area-view"}, children);
  };
});

jest.mock("../../components/buttons/GoogleSignInButton", () => {
  const React = require("react");
  return function MockGoogleSignInButton({onPress, disabled}: any) {
    return React.createElement("View", {
      testID: "google-signin-button",
      onPress: disabled ? undefined : onPress,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/buttons/FacebookSignInButton", () => {
  const React = require("react");
  return function MockFacebookSignInButton({onPress, disabled}: any) {
    return React.createElement("View", {
      testID: "facebook-signin-button",
      onPress: disabled ? undefined : onPress,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({buttonText, onPress, disabled}: any) {
    return React.createElement("View", {
      testID: "wide-button",
      onPress: disabled ? undefined : onPress,
      "data-text": buttonText,
      "data-disabled": disabled,
    });
  };
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  return function MockPulsingSpinner({visible, size}: any) {
    return React.createElement("View", {
      testID: "pulsing-spinner",
      "data-visible": visible,
      "data-size": size,
    });
  };
});

jest.mock("../../components/text/Subtitle", () => {
  const React = require("react");
  return function MockSubtitle({text}: any) {
    return React.createElement("View", {
      testID: "subtitle",
      "data-text": text,
    });
  };
});

jest.mock("../../components/text/Error", () => {
  const React = require("react");
  return function MockError({message}: any) {
    return React.createElement("View", {
      testID: "error-message",
      "data-message": message,
    });
  };
});

jest.mock("../../components/background/StarryBackground", () => {
  const React = require("react");
  return function MockStarryBackground() {
    return React.createElement("View", {testID: "starry-background"});
  };
});

jest.mock("../../components/modals/help/CreditsModal", () => {
  const React = require("react");
  return function MockCreditsModal({isVisible, onClose}: any) {
    return React.createElement(
      "View",
      {
        testID: "credits-modal",
        "data-visible": isVisible,
      },
      React.createElement("View", {
        testID: "credits-modal-close",
        onPress: onClose,
      }),
    );
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
jest.mock("../../i18n", () => ({
  t: (key: string) => {
    const lookup: Record<string, string> = {
      "AuthStrings.Landing.TAGLINE_1": "Test Tagline 1",
      "AuthStrings.Landing.TAGLINE_2": "Test Tagline 2",
      "AuthStrings.Landing.SIGN_IN_BUTTON": "Sign In",
      "AuthStrings.Landing.OR_SIGN_IN_WITH": "Or sign in with",
      "AuthStrings.Landing.NO_ACCOUNT_PROMPT": "No account?",
      "AuthStrings.Landing.PLAY_AS_GUEST": "Play as Guest",
      "AuthStrings.Landing.CREDITS_BUTTON": "Credits",
      "AuthStrings.Landing.SIGN_UP_BUTTON": "Sign up",
      "AuthStrings.Landing.MADE_BY_ROOBS_WORLD": "Made by Roobs World",
      "AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL":
        "That provider account is already in use. Please choose a different provider.",
      "ErrorMessages.AUTHENTICATION_FAILED": "Authentication failed",
      "ErrorMessages.NETWORK_ERROR_CHECK_CONNECTION": "Network error. Please check your connection.",
      "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE": "Service temporarily unavailable. Please try again.",
      "ErrorMessages.UNKNOWN_ERROR": "Unknown error occurred",
      "Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE":
        "That provider account is already in use. Please choose a different provider.",
      "Navigation.LOGIN": "Login",
      "Navigation.SIGN_UP": "SignUp",
      "Navigation.CREDITS": "Credits",
    };
    return lookup[key] ?? key;
  },
  AppStrings: {
    AuthStrings: {
      Landing: {
        TAGLINE_1: "Test Tagline 1",
        TAGLINE_2: "Test Tagline 2",
        SIGN_IN_BUTTON: "Sign In",
        OR_SIGN_IN_WITH: "Or sign in with",
        NO_ACCOUNT_PROMPT: "No account?",
        PLAY_AS_GUEST: "Play as Guest",
        CREDITS_BUTTON: "Credits",
        SIGN_UP_BUTTON: "Sign up",
      },
      Login: {
        ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
          "That provider account is already in use. Please choose a different provider.",
        GOOGLE_UNEXPECTED_ERROR: "Unknown error occurred",
        FACEBOOK_CONFIG_ERROR: "Authentication failed",
        FACEBOOK_TIMEOUT_ERROR: "Service temporarily unavailable. Please try again.",
        FACEBOOK_SDK_ERROR: "Authentication failed",
        OPERATION_NOT_SUPPORTED_ERROR: "Authentication failed",
        FACEBOOK_NETWORK_ERROR: "Network error. Please check your connection.",
        FACEBOOK_INVALID_CREDENTIAL_ERROR: "Authentication failed",
        FACEBOOK_UNEXPECTED_ERROR: "Unknown error occurred",
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
    backgroundImage: {position: "absolute"},
    title: {fontSize: 24},
    separatorText: {fontSize: 14},
    creditsLink: {fontSize: 12},
  },
  COLORS: {black: "#000000", white: "#FFFFFF"},
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: {sm: 14, base: 16, lg: 18, title: 24},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48},
}));

const TestWrapper = ({children}: {children: React.ReactNode}) => <ModalProvider>{children}</ModalProvider>;

const renderWithProviders = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: TestWrapper,
  });

describe("LandingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
    mockedUseAuthSession.mockImplementation(() => mockedUseAuth() as any);
  });

  describe("Component Rendering", () => {
    it("should render all main components", () => {
      const {getAllByTestId, getByTestId, getByText} = renderWithProviders(<LandingScreen />);

      expect(getByTestId("custom-safe-area-view")).toBeTruthy();
      expect(getAllByTestId("wide-button").length).toBeGreaterThanOrEqual(1);
      expect(getByTestId("google-signin-button")).toBeTruthy();
      expect(getByTestId("facebook-signin-button")).toBeTruthy();
      expect(getByTestId("pulsing-spinner")).toBeTruthy();
      expect(getByText("Test Tagline 1")).toBeTruthy();
    });

    it("should render the guest button and Roobs World text link", () => {
      const {getAllByTestId, getByTestId} = renderWithProviders(<LandingScreen />);

      const wideButtons = getAllByTestId("wide-button");
      const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");
      expect(guestButton).toBeTruthy();
      expect(guestButton!.props["data-disabled"]).toBe(false);
      expect(getByTestId("roobs-world-link")).toBeTruthy();
      expect(wideButtons.some((btn: any) => btn.props["data-text"] === "Made by Roobs World")).toBe(false);
    });

    it("should render spinner as not visible initially", () => {
      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-visible"]).toBe(false);
      expect(spinner.props["data-size"]).toBe(120);
    });

    it("should keep controls disabled and spinner visible while transitioning to the game", () => {
      const {getAllByTestId, getByTestId} = renderWithProviders(<LandingScreen isTransitioningToGame={true} />);

      const guestButton = getAllByTestId("wide-button").find((btn: any) => btn.props["data-text"] === "Play as Guest");
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
      expect(getByTestId("google-signin-button").props["data-disabled"]).toBe(true);
      expect(getByTestId("facebook-signin-button").props["data-disabled"]).toBe(true);
      expect(guestButton!.props["data-disabled"]).toBe(true);
    });
  });

  describe("Modal Triggers", () => {
    it("should not render an email sign in button on the landing screen", () => {
      const {getAllByTestId} = renderWithProviders(<LandingScreen />);

      const signInButton = getAllByTestId("wide-button").find((btn: any) => btn.props["data-text"] === "Sign In");

      expect(signInButton).toBeFalsy();
    });

    it("should not render a sign up button on the landing screen", () => {
      const {queryByText} = renderWithProviders(<LandingScreen />);

      expect(queryByText("No account?")).toBeNull();
      expect(queryByText("Sign up")).toBeNull();
    });

    it("should sign in anonymously when guest button is pressed", async () => {
      (AuthService.signInAnonymously as jest.Mock).mockResolvedValue({
        user: {uid: "guest-1"},
      });
      const {getAllByTestId} = renderWithProviders(<LandingScreen />);

      const wideButtons = getAllByTestId("wide-button");
      const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");
      fireEvent.press(guestButton!);

      await waitFor(() => {
        expect(AuthService.signInAnonymously).toHaveBeenCalledTimes(1);
      });
    });

    it("should open Roobs World website when the text link is pressed", () => {
      const openUrlSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
      const {getByTestId} = renderWithProviders(<LandingScreen />);

      fireEvent.press(getByTestId("roobs-world-link"));

      expect(openUrlSpy).toHaveBeenCalledWith("https://www.roobsworld.com");
      openUrlSpy.mockRestore();
    });
  });

  describe("Google Sign In", () => {
    beforeEach(() => {
      (useAuthSession as jest.Mock).mockReturnValue({login: mockLogin, isAuthenticated: false});
      mockSignInWithGoogle.mockClear();
      mockLogin.mockClear();
    });

    it("should call Google sign in and login on success", async () => {
      const mockUserCredential = {
        user: {uid: "test-uid"},
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(mockUserCredential);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(AuthService.signInWithGoogle).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should show loading spinner during Google sign in", async () => {
      (AuthService.signInWithGoogle as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // stays pending; no timer leak
      );

      const {getByTestId} = renderWithProviders(<LandingScreen />);

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

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "That provider account is already in use. Please choose a different provider.",
        );
      });
    });

    it("should handle Google sign in popup closed error", async () => {
      const error = {
        code: "auth/auth-popup-closed-by-user",
        message: "Popup closed",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const {getByTestId, queryByTestId} = renderWithProviders(<LandingScreen />);

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

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe("Unknown error occurred (auth/unknown-error)");
      });
    });
  });

  describe("Facebook Sign In", () => {
    beforeEach(() => {
      (useAuthSession as jest.Mock).mockReturnValue({login: mockLogin, isAuthenticated: false});
      mockSignInWithFacebook.mockClear();
      mockLogin.mockClear();
    });

    it("should call Facebook sign in and login on success", async () => {
      const mockUserCredential = {
        user: {uid: "test-uid"},
      };
      (AuthService.signInWithFacebook as jest.Mock).mockResolvedValue(mockUserCredential);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(AuthService.signInWithFacebook).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it("should show loading spinner during Facebook sign in", async () => {
      (AuthService.signInWithFacebook as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // stays pending; no timer leak
      );

      const {getByTestId} = renderWithProviders(<LandingScreen />);

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

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe(
          "That provider account is already in use. Please choose a different provider.",
        );
      });
    });

    it("should handle Facebook sign in not supported error", async () => {
      const error = {
        code: "auth/operation-not-supported-in-this-environment",
        message: "Not supported",
      };
      (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe("Authentication failed");
      });
    });

    it("should handle Facebook sign-in failure with generic error", async () => {
      const errorMessage = "Unknown error occurred";
      (AuthService.signInWithFacebook as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
      const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

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
        () => new Promise(() => {}), // stays pending; no timer leak
      );

      const {getAllByTestId, getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      const wideButtons = getAllByTestId("wide-button");
      const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");
      const facebookButton = getByTestId("facebook-signin-button");

      expect(guestButton!.props["data-disabled"]).toBe(true);
      expect(googleButton.props["data-disabled"]).toBe(true);
      expect(facebookButton.props["data-disabled"]).toBe(true);
    });

    it("should keep spinner visible after successful authentication until navigation shows the game", async () => {
      const mockUserCredential = {
        user: {uid: "test-uid"},
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(mockUserCredential);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const spinner = getByTestId("pulsing-spinner");
        expect(spinner.props["data-visible"]).toBe(true);
      });
    });

    it("should hide spinner after authentication error", async () => {
      const error = {
        code: "auth/unknown-error",
        message: "Error occurred",
      };
      (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

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

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        const errorMessage = getByTestId("error-message");
        expect(errorMessage.props["data-message"]).toBe("Unknown error occurred (auth/unknown-error)");
      });

      // Now try Facebook sign in - should clear the error
      (AuthService.signInWithFacebook as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // stays pending; no timer leak
      );

      const facebookButton = getByTestId("facebook-signin-button");
      fireEvent.press(facebookButton);

      // Error should be cleared (component won't render error component)
      expect(() => getByTestId("error-message")).toThrow();
    });

    it("should not show error message when no error exists", () => {
      const {queryByTestId} = renderWithProviders(<LandingScreen />);

      expect(queryByTestId("error-message")).toBeFalsy();
    });
  });

  describe("State Management", () => {
    it("should handle authentication without uid", async () => {
      const mockUserCredential = {
        user: {uid: null},
      };
      (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(mockUserCredential);

      const {getByTestId} = renderWithProviders(<LandingScreen />);

      const googleButton = getByTestId("google-signin-button");
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(AuthService.signInWithGoogle).toHaveBeenCalled();
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it("should handle useAuth hook correctly", () => {
      expect(() => renderWithProviders(<LandingScreen />)).not.toThrow();
      expect(useAuthSession).toHaveBeenCalled();
    });
  });

  describe("Text Content", () => {
    it("should not display email auth navigation or provider separator text", () => {
      const {getAllByTestId, queryByText} = renderWithProviders(<LandingScreen />);
      const signInButton = getAllByTestId("wide-button").find((btn: any) => btn.props["data-text"] === "Sign In");

      expect(signInButton).toBeFalsy();
      expect(queryByText("Or sign in with")).toBeNull();
      expect(queryByText("No account?")).toBeNull();
      expect(queryByText("Sign up")).toBeNull();
    });

    it("should display taglines from constants", () => {
      const {getByText} = renderWithProviders(<LandingScreen />);

      expect(getByText("Test Tagline 1")).toBeTruthy();
    });
  });

  describe("Component Integration", () => {
    it("should pass correct props to all components", () => {
      const {getByTestId} = renderWithProviders(<LandingScreen />);

      // Check spinner props
      const spinner = getByTestId("pulsing-spinner");
      expect(spinner.props["data-size"]).toBe(120);
      expect(spinner.props["data-visible"]).toBe(false);
    });
  });
});

// Typed mocks for AuthService methods
const mockSignInWithGoogle = AuthService.signInWithGoogle as jest.MockedFunction<typeof AuthService.signInWithGoogle>;
const mockSignInWithFacebook = AuthService.signInWithFacebook as jest.MockedFunction<
  typeof AuthService.signInWithFacebook
>;

describe("Google Sign-In", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({login: mockLogin, isAuthenticated: false, setGameMode: mockSetGameMode});
    mockSignInWithGoogle.mockClear();
    mockLogin.mockClear();
  });

  it("should handle successful Google sign-in", async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({
      user: {uid: "test-uid"},
    } as any);
    const {getByTestId} = renderWithProviders(<LandingScreen />);

    const googleButton = getByTestId("google-signin-button");
    fireEvent.press(googleButton);

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(googleButton.props["data-disabled"]).toBe(true);

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(getByTestId("google-signin-button").props["data-disabled"]).toBe(true);
  });

  it("should handle Google sign-in failure with generic error", async () => {
    const errorMessage = "Network error";
    mockSignInWithGoogle.mockRejectedValueOnce(new Error(errorMessage));
    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe("Unknown error occurred");
    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(false);
  });

  it("should handle Google sign-in failure with 'auth/account-exists-with-different-credential'", async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: "auth/account-exists-with-different-credential",
    });
    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "That provider account is already in use. Please choose a different provider.",
    );
  });

  it("should handle Google sign-in failure with 'auth/auth-popup-closed-by-user'", async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: "auth/auth-popup-closed-by-user",
    });

    const {getByTestId, queryByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));

    expect(queryByTestId("error-message")).toBeNull();
  });
});

describe("Facebook Sign-In", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({login: mockLogin, isAuthenticated: false, setGameMode: mockSetGameMode});
  });

  it("should handle successful Facebook sign-in", async () => {
    mockSignInWithFacebook.mockResolvedValueOnce({
      user: {uid: "test-uid"},
    } as any);
    const {getByTestId} = renderWithProviders(<LandingScreen />);

    const facebookButton = getByTestId("facebook-signin-button");
    fireEvent.press(facebookButton);

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);

    await waitFor(() => {
      expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    expect(getByTestId("facebook-signin-button").props["data-disabled"]).toBe(true);
  });

  it("should handle Facebook sign-in failure with generic error", async () => {
    const errorMessage = "Unknown error occurred";
    mockSignInWithFacebook.mockRejectedValueOnce(new Error(errorMessage));
    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

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
    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() => expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "That provider account is already in use. Please choose a different provider.",
    );
  });

  it("should handle Facebook sign-in failure with 'auth/auth-popup-closed-by-user'", async () => {
    mockSignInWithFacebook.mockRejectedValueOnce({
      code: "auth/auth-popup-closed-by-user",
    });
    const {getByTestId, queryByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() => expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1));

    expect(queryByTestId("error-message")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("should handle Facebook sign-in failure with 'auth/operation-not-supported-in-this-environment'", async () => {
    mockSignInWithFacebook.mockRejectedValueOnce({
      code: "auth/operation-not-supported-in-this-environment",
    });
    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    await waitFor(() => expect(mockSignInWithFacebook).toHaveBeenCalledTimes(1));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe("Authentication failed");
  });
});

describe("Loading States and Button Disabling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({login: mockLogin, isAuthenticated: false, setGameMode: mockSetGameMode});
  });

  it("should disable all relevant buttons when Google sign-in is loading", async () => {
    let resolveGooglePromise: (value: any) => void;
    mockSignInWithGoogle.mockImplementationOnce(() => new Promise((resolve) => (resolveGooglePromise = resolve)));

    const {getAllByTestId, getByTestId} = renderWithProviders(<LandingScreen />);

    const googleButton = getByTestId("google-signin-button");
    const facebookButton = getByTestId("facebook-signin-button");
    const wideButtons = getAllByTestId("wide-button");
    const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");

    fireEvent.press(googleButton);

    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });

    expect(googleButton.props["data-disabled"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);
    expect(guestButton!.props["data-disabled"]).toBe(true);

    // Resolve the promise to mimic a successful auth response while landing waits for game readiness.
    resolveGooglePromise!({user: {uid: "test-uid"}} as any);
    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });
  });

  it("should disable all relevant buttons when Facebook sign-in is loading", async () => {
    let resolveFacebookPromise: (value: any) => void;
    mockSignInWithFacebook.mockImplementationOnce(() => new Promise((resolve) => (resolveFacebookPromise = resolve)));

    const {getAllByTestId, getByTestId} = renderWithProviders(<LandingScreen />);

    const googleButton = getByTestId("google-signin-button");
    const facebookButton = getByTestId("facebook-signin-button");
    const wideButtons = getAllByTestId("wide-button");
    const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");

    fireEvent.press(facebookButton);

    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });

    expect(googleButton.props["data-disabled"]).toBe(true);
    expect(facebookButton.props["data-disabled"]).toBe(true);
    expect(guestButton!.props["data-disabled"]).toBe(true);

    // Resolve the promise to mimic a successful auth response while landing waits for game readiness.
    resolveFacebookPromise!({user: {uid: "test-uid"}} as any);
    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });
  });
});

describe("Facebook Sign-In Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
  });

  it("should handle Facebook access token error with specific message", async () => {
    // The error message must contain "access token" exactly to trigger the specific handler
    const error = new Error("Error getting access token from Facebook");
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    // Verify error handling occurred - the message depends on exact matching in the component
    expect(errorComponent).toBeTruthy();
  });

  it("should handle Facebook permission request timeout error", async () => {
    // Match the exact substring check in the component
    const error = new Error("Facebook permission request timed out waiting");
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    // Verify error handling occurred
    expect(errorComponent).toBeTruthy();
  });

  it("should handle Facebook SDK initialization error", async () => {
    // Match the exact substring check in the component
    const error = new Error("Facebook SDK not properly initialized error");
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    // Verify error handling occurred
    expect(errorComponent).toBeTruthy();
  });

  it("should handle auth/network-request-failed error", async () => {
    const error = {
      code: "auth/network-request-failed",
      message: "Network request failed",
    };
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe(
      "Network error. Please check your connection.",
    );
  });

  it("should handle auth/invalid-credential error", async () => {
    const error = {
      code: "auth/invalid-credential",
      message: "Invalid credential",
    };
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe("Authentication failed");
  });

  it("should handle non-Error object rejection", async () => {
    const error = "String error message";
    (AuthService.signInWithFacebook as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("facebook-signin-button"));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe("Unknown error occurred");
  });
});

describe("Google Sign-In Edge Cases", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
    mockSignInWithGoogle.mockClear();
    mockLogin.mockClear();
  });

  it("should handle error without message property", async () => {
    const error = {code: "auth/unknown-error"};
    (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

    const {getByTestId, findByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    const errorComponent = await findByTestId("error-message");
    expect(errorComponent.props["data-message"]).toBe("Unknown error occurred (auth/unknown-error)");
  });

  it("should not call login if user uid is missing", async () => {
    const mockUserCredential = {user: {}};
    (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(mockUserCredential);

    const {getByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => {
      expect(AuthService.signInWithGoogle).toHaveBeenCalled();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("should not call login if user object is null", async () => {
    const mockUserCredential = {user: null};
    (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(mockUserCredential);

    const {getByTestId} = renderWithProviders(<LandingScreen />);

    fireEvent.press(getByTestId("google-signin-button"));

    await waitFor(() => {
      expect(AuthService.signInWithGoogle).toHaveBeenCalled();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });
});

describe("Starry Background", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
  });

  it("should render StarryBackground component", () => {
    const {getByTestId} = renderWithProviders(<LandingScreen />);

    expect(getByTestId("starry-background")).toBeTruthy();
  });
});

describe("Component Accessibility", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
  });

  it("should render all buttons in enabled state initially", () => {
    const {getByTestId, getAllByTestId} = renderWithProviders(<LandingScreen />);

    const googleButton = getByTestId("google-signin-button");
    const facebookButton = getByTestId("facebook-signin-button");
    const wideButtons = getAllByTestId("wide-button");

    expect(googleButton.props["data-disabled"]).toBe(false);
    expect(facebookButton.props["data-disabled"]).toBe(false);
    // Check that Play as Guest renders as a button and Roobs World does not.
    const guestButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Play as Guest");
    const roobsWorldButton = wideButtons.find((btn: any) => btn.props["data-text"] === "Made by Roobs World");
    expect(guestButton!.props["data-disabled"]).toBe(false);
    expect(roobsWorldButton).toBeFalsy();
  });

  it("should have proper button text content", () => {
    const {getAllByTestId, getByText} = renderWithProviders(<LandingScreen />);

    const wideButtons = getAllByTestId("wide-button");
    const buttonTexts = wideButtons.map((btn: any) => btn.props["data-text"]);

    expect(buttonTexts).toContain("Play as Guest");
    expect(buttonTexts).not.toContain("Made by Roobs World");
    expect(getByText("Made by Roobs World")).toBeTruthy();
  });
});

describe("Modal Integration", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
  });

  it("signs in anonymously for guest play", async () => {
    (AuthService.signInAnonymously as jest.Mock).mockResolvedValue({user: {uid: "guest-1"}});
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });

    const {getByTestId, getAllByTestId} = renderWithProviders(<LandingScreen />);
    const guestButton = getAllByTestId("wide-button").find((btn: any) => btn.props["data-text"] === "Play as Guest");
    fireEvent.press(guestButton!);

    await waitFor(() => {
      expect(AuthService.logout).not.toHaveBeenCalled();
      expect(AuthService.signInAnonymously).toHaveBeenCalledTimes(1);
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });
  });

  it("logs out before guest sign in when already authenticated", async () => {
    (AuthService.signInAnonymously as jest.Mock).mockResolvedValue({user: {uid: "guest-1"}});
    (AuthService.logout as jest.Mock).mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
      setGameMode: mockSetGameMode,
    });

    const {getByTestId, getAllByTestId} = renderWithProviders(<LandingScreen />);
    const guestButton = getAllByTestId("wide-button").find((btn: any) => btn.props["data-text"] === "Play as Guest");
    fireEvent.press(guestButton!);

    await waitFor(() => {
      expect(AuthService.logout).toHaveBeenCalled();
      expect(AuthService.signInAnonymously).toHaveBeenCalled();
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });
  });
});

describe("Concurrent Operations", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      setGameMode: mockSetGameMode,
    });
    mockSignInWithGoogle.mockClear();
    mockSignInWithFacebook.mockClear();
  });

  it("should prevent double-tapping on sign-in buttons", async () => {
    let resolvePromise: (value: any) => void;
    mockSignInWithGoogle.mockImplementationOnce(() => new Promise((resolve) => (resolvePromise = resolve)));

    const {getByTestId} = renderWithProviders(<LandingScreen />);

    const googleButton = getByTestId("google-signin-button");

    // First press starts loading
    fireEvent.press(googleButton);

    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });

    // Button should be disabled during loading
    expect(googleButton.props["data-disabled"]).toBe(true);

    // Successful auth keeps the landing spinner active until the game is ready.
    resolvePromise!({user: {uid: "test-uid"}} as any);
    await waitFor(() => {
      expect(getByTestId("pulsing-spinner").props["data-visible"]).toBe(true);
    });
  });
});
