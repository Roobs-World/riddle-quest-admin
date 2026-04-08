import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ChangePasswordModal from "../ChangePasswordModal";
import { Alert } from "react-native";

// Mock Firebase Auth
const mockReauthenticateWithCredential = jest.fn();
const mockUpdatePassword = jest.fn();
const mockCurrentUser = {
  email: "test@example.com",
  reauthenticateWithCredential: mockReauthenticateWithCredential,
  updatePassword: mockUpdatePassword,
};

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => ({
    currentUser: mockCurrentUser,
  }),
  EmailAuthProvider: {
    credential: jest.fn().mockReturnValue("mock-credential"),
  },
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue("mock-app"),
}));

jest.mock("src/utils/responsive", () => ({
  scale: (n: number) => n,
  moderateScale: (n: number) => n,
  verticalScale: (n: number) => n,
  dimensions: { screenWidth: 390, screenHeight: 844, isLargeTablet: false },
  responsiveSizes: {
    textXs: 12, textSm: 14, textBase: 16, textLg: 18, textXl: 20,
    text2xl: 24, text3xl: 30, text4xl: 36, textTitle: 28, textDisplay: 32, textTile: 28,
    spacingXs: 4, spacingSm: 8, spacingMd: 16, spacingLg: 24, spacingXl: 32, spacing2xl: 48,
    buttonHeight: 48, inputHeight: 48, headerHeight: 60, tabBarHeight: 60,
    radiusSm: 4, radiusMd: 8, radiusLg: 12, radiusXl: 16, radiusXxl: 20, radiusFull: 9999,
  },
}));
jest.mock("src/styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.1, normal: 0, wide: 0.025 },
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}));
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.1, normal: 0, wide: 0.025 },
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}));

jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockModalBg = (props: any) =>
    React.createElement(View, { testID: "modal-bg", ...props });
  MockModalBg.displayName = "MockModalBg";
  return MockModalBg;
});

// Mock CloseButton
jest.mock("../../../buttons/CloseButton", () => {
  const MockCloseButton = ({ onPress }: { onPress: () => void }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="close-button">
        <Text>Close</Text>
      </TouchableOpacity>
    );
  };
  return MockCloseButton;
});

// Mock WideButton
jest.mock("src/components/buttons/WideButton", () => {
  const MockWideButton = ({ buttonText, onPress }: { buttonText: string; onPress: () => void }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="save-button">
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
  return MockWideButton;
});

jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

describe("ChangePasswordModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByTestId } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      expect(getByTestId("mock-modal")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <ChangePasswordModal isVisible={false} onClose={mockOnClose} />
      );

      expect(queryByText("Change Password")).toBeNull();
    });

    it("should display correct form fields", () => {
      const { getByPlaceholderText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      expect(getByPlaceholderText("Current Password")).toBeTruthy();
      expect(getByPlaceholderText("New Password")).toBeTruthy();
      expect(getByPlaceholderText("Confirm New Password")).toBeTruthy();
    });
  });

  describe("User Interaction", () => {
    it("should close modal when close button is pressed", () => {
      const { getByTestId } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should update text input values when typing", () => {
      const { getByPlaceholderText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      const currentPasswordInput = getByPlaceholderText("Current Password");
      const newPasswordInput = getByPlaceholderText("New Password");
      const confirmPasswordInput = getByPlaceholderText("Confirm New Password");

      fireEvent.changeText(currentPasswordInput, "old-password");
      fireEvent.changeText(newPasswordInput, "new-password");
      fireEvent.changeText(confirmPasswordInput, "new-password");

      expect(currentPasswordInput.props.value).toBe("old-password");
      expect(newPasswordInput.props.value).toBe("new-password");
      expect(confirmPasswordInput.props.value).toBe("new-password");
    });
  });

  describe("Form Validation", () => {
    it("should show error when fields are empty", async () => {
      const { getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Please fill in all password fields."
        );
      });
    });

    it("should show error when passwords don't match", async () => {
      const { getByPlaceholderText, getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.changeText(getByPlaceholderText("Current Password"), "current");
      fireEvent.changeText(getByPlaceholderText("New Password"), "new1");
      fireEvent.changeText(
        getByPlaceholderText("Confirm New Password"),
        "new2"
      );

      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "New passwords do not match."
        );
      });
    });

    it("should show error when new password is too short", async () => {
      const { getByPlaceholderText, getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.changeText(getByPlaceholderText("Current Password"), "current");
      fireEvent.changeText(getByPlaceholderText("New Password"), "new");
      fireEvent.changeText(getByPlaceholderText("Confirm New Password"), "new");

      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "New password must be at least 6 characters long."
        );
      });
    });
  });

  describe("Password Change Flow", () => {
    it("should successfully change password with valid inputs", async () => {
      const { getByPlaceholderText, getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.changeText(
        getByPlaceholderText("Current Password"),
        "current123"
      );
      fireEvent.changeText(getByPlaceholderText("New Password"), "newpass123");
      fireEvent.changeText(
        getByPlaceholderText("Confirm New Password"),
        "newpass123"
      );

      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
          "mock-credential"
        );
        expect(mockUpdatePassword).toHaveBeenCalledWith("newpass123");
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Password updated successfully!"
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle authentication errors", async () => {
      mockReauthenticateWithCredential.mockRejectedValue({
        code: "auth/invalid-credential",
        message: "Invalid credentials",
      });

      const { getByPlaceholderText, getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.changeText(getByPlaceholderText("Current Password"), "wrong");
      fireEvent.changeText(getByPlaceholderText("New Password"), "newpass123");
      fireEvent.changeText(
        getByPlaceholderText("Confirm New Password"),
        "newpass123"
      );

      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Invalid current password."
        );
      });
    });
  });
});
