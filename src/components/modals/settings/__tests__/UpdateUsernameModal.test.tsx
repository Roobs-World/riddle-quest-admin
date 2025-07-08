import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import UpdateUsernameModal from "../UpdateUsernameModal";
import { Alert } from "react-native";

// Mock Firebase Functions
const mockProcessFormSubmissionCallable = jest.fn();
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: () => ({
    httpsCallable: () => mockProcessFormSubmissionCallable,
  }),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue("mock-app"),
}));

// Mock useAuth hook
const mockUpdatePlayerData = jest.fn();
jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    updatePlayerData: mockUpdatePlayerData,
  }),
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

describe("UpdateUsernameModal", () => {
  const mockOnClose = jest.fn();
  const currentUsername = "TestUser";

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessFormSubmissionCallable.mockResolvedValue({
      data: { success: true, message: "Username updated successfully!" },
    });
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByTestId } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByTestId } = render(
        <UpdateUsernameModal
          isVisible={false}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
    });

    it("should display correct form field with current username", () => {
      const { getByPlaceholderText, getByDisplayValue } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      expect(getByPlaceholderText("Enter new username")).toBeTruthy();
      expect(getByDisplayValue(currentUsername)).toBeTruthy();
    });
  });

  describe("User Interaction", () => {
    it("should close modal when close button is pressed", () => {
      const { getByTestId } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should close modal when cancel button is pressed", () => {
      const { getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.press(getByText("Cancel"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should update text input value when typing", () => {
      const { getByPlaceholderText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      const usernameInput = getByPlaceholderText("Enter new username");
      fireEvent.changeText(usernameInput, "NewUsername");

      expect(usernameInput.props.value).toBe("NewUsername");
    });

    it("should reset username when modal closes", () => {
      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      const usernameInput = getByPlaceholderText("Enter new username");
      fireEvent.changeText(usernameInput, "ChangedUsername");
      fireEvent.press(getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Form Validation", () => {
    it("should show error when username is empty", async () => {
      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "");
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Username cannot be empty."
        );
      });
    });

    it("should show error when username is too short", async () => {
      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.changeText(getByPlaceholderText("Enter new username"), "ab");
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Username must be at least 3 characters long."
        );
      });
    });
  });

  describe("Username Update Flow", () => {
    it("should successfully update username with valid input", async () => {
      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.changeText(
        getByPlaceholderText("Enter new username"),
        "NewUsername"
      );
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(mockProcessFormSubmissionCallable).toHaveBeenCalledWith({
          formType: "profileUpdate",
          formData: {
            displayName: "NewUsername",
          },
        });
        expect(mockUpdatePlayerData).toHaveBeenCalledWith({
          username: "NewUsername",
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Username updated successfully!"
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle server errors", async () => {
      mockProcessFormSubmissionCallable.mockRejectedValue({
        code: "invalid-argument",
        message: "Invalid username data provided.",
      });

      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.changeText(
        getByPlaceholderText("Enter new username"),
        "NewUsername"
      );
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Invalid username data provided."
        );
      });
    });

    it("should handle unsuccessful response from server", async () => {
      mockProcessFormSubmissionCallable.mockResolvedValue({
        data: { success: false, message: "Username already exists." },
      });

      const { getByPlaceholderText, getByText } = render(
        <UpdateUsernameModal
          isVisible={true}
          onClose={mockOnClose}
          currentUsername={currentUsername}
        />
      );

      fireEvent.changeText(
        getByPlaceholderText("Enter new username"),
        "ExistingUsername"
      );
      fireEvent.press(getByText("Save"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Username already exists."
        );
      });
    });
  });
});
