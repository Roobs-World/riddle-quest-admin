import React from "react";
import { render } from "@testing-library/react-native";
import { Navigation } from "../NavigationStack";
import { useAuth } from "../../contexts/AuthContext";
import { AppStrings } from "../../constants/AppStrings";

// Mock all dependencies
jest.mock("../../screens/LandingScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockLandingScreen = () => <View testID="landing-screen" />;
  MockLandingScreen.displayName = "MockLandingScreen";
  return MockLandingScreen;
});

jest.mock("../../screens/auth/LoginScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockLoginScreen = () => <View testID="login-screen" />;
  MockLoginScreen.displayName = "MockLoginScreen";
  return MockLoginScreen;
});

jest.mock("../../screens/auth/SignUpScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockSignUpScreen = () => <View testID="signup-screen" />;
  MockSignUpScreen.displayName = "MockSignUpScreen";
  return MockSignUpScreen;
});

jest.mock("../../screens/auth/ForgotPasswordScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockForgotPasswordScreen = () => (
    <View testID="forgot-password-screen" />
  );
  MockForgotPasswordScreen.displayName = "MockForgotPasswordScreen";
  return MockForgotPasswordScreen;
});

jest.mock("../../screens/auth/NewPasswordScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockNewPasswordScreen = () => <View testID="new-password-screen" />;
  MockNewPasswordScreen.displayName = "MockNewPasswordScreen";
  return MockNewPasswordScreen;
});

jest.mock("../../screens/game/GameScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockGameScreen = () => <View testID="game-screen" />;
  MockGameScreen.displayName = "MockGameScreen";
  return MockGameScreen;
});

jest.mock("../../screens/CreditsScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockCreditsScreen = () => <View testID="credits-screen" />;
  MockCreditsScreen.displayName = "MockCreditsScreen";
  return MockCreditsScreen;
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockPulsingSpinner = (props: any) => (
    <View
      testID="pulsing-spinner"
      accessibilityLabel={`visible:${props.visible},opacity:${props.opacity},size:${props.size}`}
    />
  );
  MockPulsingSpinner.displayName = "MockPulsingSpinner";
  return MockPulsingSpinner;
});

jest.mock("../../services/FirestoreService", () => ({
  fetchClassicRiddleFromFirestore: jest.fn(),
}));

jest.mock("../../contexts/AuthContext");

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children, initialRouteName }: any) => {
      const React = require("react");
      const { View } = require("react-native");
      return (
        <View
          testID="stack-navigator"
          accessibilityLabel={`initial-route:${initialRouteName}`}
        >
          {React.Children.map(children, (child: any) => {
            if (React.isValidElement(child)) {
              const { name, component: Component, options } = child.props;
              return (
                <View
                  key={name}
                  testID={`stack-screen-${name
                    .toLowerCase()
                    .replace(/\s+/g, "")}`}
                  accessibilityLabel={`header-shown:${options?.headerShown}`}
                >
                  <Component />
                </View>
              );
            }
            return child;
          })}
        </View>
      );
    },
    Screen: ({ name, component, options }: any) => {
      const React = require("react");
      // Return a React element with the props that the Navigator can read
      return React.createElement("Screen", { name, component, options });
    },
  }),
}));

// Mock console.log to track calls
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
  });

  describe("Loading states", () => {
    it("should show loading spinner when isLoading is true", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("pulsing-spinner")).toBeTruthy();
      expect(getByTestId("pulsing-spinner").props.accessibilityLabel).toContain(
        "visible:true"
      );
      expect(getByTestId("pulsing-spinner").props.accessibilityLabel).toContain(
        "size:150"
      );
      expect(getByTestId("pulsing-spinner").props.accessibilityLabel).toContain(
        "opacity:0.8"
      );
    });

    it("should show loading spinner when isRiddlesInitializing is true", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isRiddlesInitializing: true,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("pulsing-spinner")).toBeTruthy();
      expect(getByTestId("pulsing-spinner").props.accessibilityLabel).toContain(
        "visible:true"
      );
    });

    it("should show loading spinner when both isLoading and isRiddlesInitializing are true", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isRiddlesInitializing: true,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("pulsing-spinner")).toBeTruthy();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Showing loading spinner"),
        expect.stringContaining("isLoading:"),
        true,
        expect.stringContaining("isRiddlesInitializing:"),
        true,
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe("Navigation when not authenticated", () => {
    it("should render navigation stack with LANDING as initial route when not authenticated", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("stack-navigator")).toBeTruthy();
      expect(getByTestId("stack-navigator").props.accessibilityLabel).toBe(
        `initial-route:${AppStrings.Navigation.LANDING}`
      );
    });

    it("should include all auth screens in the navigation stack", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("stack-screen-landing")).toBeTruthy();
      expect(getByTestId("stack-screen-login")).toBeTruthy();
      expect(getByTestId("stack-screen-signup")).toBeTruthy();
      expect(getByTestId("stack-screen-forgotpassword")).toBeTruthy();
      expect(getByTestId("stack-screen-newpassword")).toBeTruthy();
    });
  });

  describe("Navigation when authenticated", () => {
    it("should render navigation stack with GAME as initial route when authenticated", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      expect(getByTestId("stack-navigator")).toBeTruthy();
      expect(getByTestId("stack-navigator").props.accessibilityLabel).toBe(
        `initial-route:${AppStrings.Navigation.GAME}`
      );
    });
  });

  describe("Console logging", () => {
    it("should log navigation rendering information", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      render(<Navigation />);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        AppStrings.LogMessages.NAVIGATION_RENDERING,
        false,
        AppStrings.LogMessages.IS_LOADING,
        false,
        "isRiddlesInitializing:",
        false,
        AppStrings.LogMessages.TIMESTAMP,
        expect.any(String)
      );
    });

    it("should log navigation stack information when showing navigation", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      render(<Navigation />);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        AppStrings.LogMessages.SHOWING_NAVIGATION_STACK,
        "GAME",
        AppStrings.LogMessages.TIMESTAMP,
        expect.any(String)
      );
    });

    it("should log loading spinner information when showing loading", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      render(<Navigation />);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        AppStrings.LogMessages.SHOWING_LOADING_SPINNER_AUTH,
        "isLoading:",
        true,
        "isRiddlesInitializing:",
        false,
        AppStrings.LogMessages.TIMESTAMP,
        expect.any(String)
      );
    });
  });

  describe("Screen configurations", () => {
    it("should configure all screens with headerShown: false", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        isRiddlesInitializing: false,
        playerData: null,
        currentRiddle: null,
        isDailyChallengeAvailable: false,
        gameMode: "daily",
        login: jest.fn(),
        logout: jest.fn(),
        updatePlayerClassicIndex: jest.fn(),
        updatePlayerData: jest.fn(),
        setGameMode: jest.fn(),
        setCurrentRiddle: jest.fn(),
        fetchCurrentRiddle: jest.fn(),
      });

      const { getByTestId } = render(<Navigation />);

      // Check that all screens have headerShown: false
      expect(getByTestId("stack-screen-landing").props.accessibilityLabel).toBe(
        "header-shown:false"
      );
      expect(getByTestId("stack-screen-login").props.accessibilityLabel).toBe(
        "header-shown:false"
      );
      expect(getByTestId("stack-screen-signup").props.accessibilityLabel).toBe(
        "header-shown:false"
      );
      expect(
        getByTestId("stack-screen-forgotpassword").props.accessibilityLabel
      ).toBe("header-shown:false");
      expect(
        getByTestId("stack-screen-newpassword").props.accessibilityLabel
      ).toBe("header-shown:false");
    });
  });
});
