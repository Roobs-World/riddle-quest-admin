import React from "react";
import {render, fireEvent, waitFor, act} from "@testing-library/react-native";
import UpdateUsernameModal from "../UpdateUsernameModal";

// Mock Firebase Functions
const mockProcessFormSubmissionCallable = jest.fn();
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => mockProcessFormSubmissionCallable),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue("mock-app"),
}));

// Mock useAuth hook
const mockUpdatePlayerData = jest.fn();
jest.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    updatePlayerData: mockUpdatePlayerData,
  }),
}));

// Mock CloseButton
jest.mock("../../../buttons/CloseButton", () => {
  const MockCloseButton = ({onPress}: {onPress: () => void}) => {
    const {TouchableOpacity, Text} = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="close-button">
        <Text>Close</Text>
      </TouchableOpacity>
    );
  };
  return MockCloseButton;
});

// Mock responsive/styles/ModalBg/WideButton for component dependencies
jest.mock("src/utils/responsive", () => ({
  scale: (n: number) => n,
  moderateScale: (n: number) => n,
  verticalScale: (n: number) => n,
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  responsiveSizes: {
    textXs: 12,
    textSm: 14,
    textBase: 16,
    textLg: 18,
    textXl: 20,
    text2xl: 24,
    text3xl: 30,
    text4xl: 36,
    textTitle: 28,
    textDisplay: 32,
    textTile: 28,
    spacingXs: 4,
    spacingSm: 8,
    spacingMd: 16,
    spacingLg: 24,
    spacingXl: 32,
    spacing2xl: 48,
    buttonHeight: 48,
    inputHeight: 48,
    headerHeight: 60,
    tabBarHeight: 60,
    radiusSm: 4,
    radiusMd: 8,
    radiusLg: 12,
    radiusXl: 16,
    radiusXxl: 20,
    radiusFull: 9999,
  },
}));
jest.mock("src/styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: {xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36},
    lineHeight: {tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2},
    letterSpacing: {tight: -0.1, normal: 0, wide: 0.025},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32},
}));
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: {xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36},
    lineHeight: {tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2},
    letterSpacing: {tight: -0.1, normal: 0, wide: 0.025},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32},
}));
jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const {View} = require("react-native");
  const MockModalBg = (props: any) => React.createElement(View, {testID: "modal-bg", ...props});
  MockModalBg.displayName = "MockModalBg";
  return MockModalBg;
});
jest.mock("src/components/buttons/WideButton", () => {
  const MockWideButton = ({buttonText, onPress, disabled}: any) => {
    const {TouchableOpacity, Text} = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="save-button" disabled={disabled}>
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
  return MockWideButton;
});

jest.mock("src/components/loading/PulsingSpinner", () => {
  const React = require("react");
  const {View} = require("react-native");

  return function MockPulsingSpinner({visible}: {visible?: boolean}) {
    if (!visible) return null;
    return <View testID="username-update-spinner" />;
  };
});

describe("UpdateUsernameModal", () => {
  const mockOnClose = jest.fn();
  const currentUsername = "TestUser";

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessFormSubmissionCallable.mockResolvedValue({
      data: {success: true, message: "Username updated successfully!"},
    });
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const {getByTestId} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      expect(getByTestId("mock-modal")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const {queryByText} = render(
        <UpdateUsernameModal isVisible={false} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      expect(queryByText("Update Username")).toBeNull();
    });

    it("should display correct form field with current username", () => {
      const {getByPlaceholderText, getByDisplayValue} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      expect(getByPlaceholderText("Enter new username")).toBeTruthy();
      expect(getByDisplayValue(currentUsername)).toBeTruthy();
    });
  });

  describe("User Interaction", () => {
    it("should close modal when close button is pressed", () => {
      const {getByTestId} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should update text input value when typing", () => {
      const {getByPlaceholderText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      const usernameInput = getByPlaceholderText("Enter new username");
      fireEvent.changeText(usernameInput, "NewUsername");

      expect(usernameInput.props.value).toBe("NewUsername");
    });

    it("should reset username when modal closes", () => {
      const {getByPlaceholderText, getByTestId} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      const usernameInput = getByPlaceholderText("Enter new username");
      fireEvent.changeText(usernameInput, "ChangedUsername");
      fireEvent.press(getByTestId("close-button"));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Form Validation", () => {
    it("should show local validation error when username is empty", async () => {
      const {getByPlaceholderText, getByText, queryByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "");
      fireEvent.press(getByText("Save"));

      expect(mockProcessFormSubmissionCallable).not.toHaveBeenCalled();
      expect(queryByText("Username cannot be empty.")).toBeTruthy();
    });

    it("should show local validation error for short usernames", async () => {
      const {getByPlaceholderText, getByText, queryByTestId, queryByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "ab");
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(mockProcessFormSubmissionCallable).not.toHaveBeenCalled();
      expect(queryByTestId("username-error-text")).toBeTruthy();
      expect(queryByText("Username must be at least 3 characters long.")).toBeTruthy();
    });

    it("should show local validation error for profane usernames", async () => {
      const {getByPlaceholderText, getByText, queryByTestId, queryByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "damnuser");
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(mockProcessFormSubmissionCallable).not.toHaveBeenCalled();
      expect(queryByTestId("username-error-text")).toBeTruthy();
      expect(queryByText("Username contains inappropriate language. Please choose a different username.")).toBeTruthy();
    });
  });

  describe("Username Update Flow", () => {
    it("should successfully update username with valid input", async () => {
      const {getByPlaceholderText, getByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "NewUsername");
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(mockProcessFormSubmissionCallable).toHaveBeenCalledWith({
          username: "NewUsername",
        });
        expect(mockUpdatePlayerData).toHaveBeenCalledWith({
          username: "NewUsername",
        });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle server errors", async () => {
      mockProcessFormSubmissionCallable.mockRejectedValue({
        code: "functions/invalid-argument",
        message: "[functions/invalid-argument] Invalid username data provided.",
      });

      const {getByPlaceholderText, getByText, queryByTestId, queryByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "NewUsername");
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(mockProcessFormSubmissionCallable).toHaveBeenCalled();
      expect(queryByTestId("username-error-text")).toBeTruthy();
      expect(queryByText("An error occurred.")).toBeTruthy();
    });

    it("should handle unsuccessful response from server", async () => {
      mockProcessFormSubmissionCallable.mockResolvedValue({
        data: {success: false, message: "Username already exists."},
      });

      const {getByPlaceholderText, getByText, queryByTestId, queryByText} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "ExistingUsername");
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(mockProcessFormSubmissionCallable).toHaveBeenCalled();
      expect(queryByTestId("username-error-text")).toBeTruthy();
      expect(queryByText("Username already exists.")).toBeTruthy();
    });

    it("should show spinner while username update is in-flight", async () => {
      let resolvePromise: ((value: {data: {success: boolean; message: string}}) => void) | undefined;
      mockProcessFormSubmissionCallable.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const {getByPlaceholderText, getByText, getByTestId, queryByTestId} = render(
        <UpdateUsernameModal isVisible={true} onClose={mockOnClose} currentUsername={currentUsername} />,
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "NewUsername");
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(getByTestId("username-update-spinner")).toBeTruthy();
      });

      await act(async () => {
        resolvePromise?.({data: {success: true, message: "Username updated successfully!"}});
      });

      await waitFor(() => {
        expect(queryByTestId("username-update-spinner")).toBeNull();
      });
    });
  });
});
