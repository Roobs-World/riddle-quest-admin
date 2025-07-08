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

// Mock CloseButton
jest.mock("../../buttons/CloseButton", () => {
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

// Mock React Native Alert
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Alert: {
    alert: jest.fn(),
  },
}));

describe("ChangePasswordModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByTestId } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByTestId } = render(
        <ChangePasswordModal isVisible={false} onClose={mockOnClose} />
      );

      expect(queryByTestId("modal")).toBeNull();
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

    it("should close modal when cancel button is pressed", () => {
      const { getByText } = render(
        <ChangePasswordModal isVisible={true} onClose={mockOnClose} />
      );

      fireEvent.press(getByText("Cancel"));
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

      fireEvent.press(getByText("Save Changes"));

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

      fireEvent.press(getByText("Save Changes"));

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

      fireEvent.press(getByText("Save Changes"));

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

      fireEvent.press(getByText("Save Changes"));

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

      fireEvent.press(getByText("Save Changes"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Invalid current password."
        );
      });
    });
  });
});
