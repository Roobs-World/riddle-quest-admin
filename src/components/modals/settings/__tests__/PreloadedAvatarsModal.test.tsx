import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PreloadedAvatarsModal from "../PreloadedAvatarsModal";
import { Alert } from "react-native";

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

describe("PreloadedAvatarsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnCloseAvatarOptions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePlayerData.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={false}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
    });

    it("should display the modal title", () => {
      const { getByText } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(getByText("Select Avatar")).toBeTruthy();
    });

    it("should display preloaded avatar images", () => {
      const { getAllByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      // Should have avatar images rendered
      const avatarImages = getAllByTestId("avatar-image");
      expect(avatarImages.length).toBeGreaterThan(0);
    });

    it("should display cancel button", () => {
      const { getByText } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(getByText("Cancel")).toBeTruthy();
    });
  });

  describe("User Interaction", () => {
    it("should close modal when close button is pressed", () => {
      const { getByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should close modal when cancel button is pressed", () => {
      const { getByText } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      fireEvent.press(getByText("Cancel"));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Avatar Selection Flow", () => {
    it("should successfully select and update avatar", async () => {
      const { getAllByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      // Get the first avatar image and click it
      const avatarImages = getAllByTestId("avatar-image");
      expect(avatarImages.length).toBeGreaterThan(0);

      // Find the parent TouchableOpacity of the first avatar image
      const firstAvatarButton = avatarImages[0].parent;
      expect(firstAvatarButton).toBeTruthy();
      fireEvent.press(firstAvatarButton!);

      await waitFor(() => {
        expect(mockUpdatePlayerData).toHaveBeenCalledWith({
          avatarUrl: expect.any(String),
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Avatar updated successfully!"
        );
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockOnCloseAvatarOptions).toHaveBeenCalled();
      });
    });

    it("should handle errors when updating avatar", async () => {
      mockUpdatePlayerData.mockRejectedValue(new Error("Update failed"));

      const { getAllByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      // Get the first avatar image and click it
      const avatarImages = getAllByTestId("avatar-image");
      const firstAvatarButton = avatarImages[0].parent;
      expect(firstAvatarButton).toBeTruthy();
      fireEvent.press(firstAvatarButton!);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Could not update avatar. Please try again."
        );
      });
    });
  });

  describe("Modal Behavior", () => {
    it("should call both close callbacks when avatar is selected", async () => {
      const { getAllByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      const avatarImages = getAllByTestId("avatar-image");
      const firstAvatarButton = avatarImages[0].parent;
      expect(firstAvatarButton).toBeTruthy();
      fireEvent.press(firstAvatarButton!);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockOnCloseAvatarOptions).toHaveBeenCalled();
      });
    });

    it("should only call onClose when cancel button is pressed", () => {
      const { getByText } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      fireEvent.press(getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnCloseAvatarOptions).not.toHaveBeenCalled();
    });

    it("should only call onClose when close button is pressed", () => {
      const { getByTestId } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      fireEvent.press(getByTestId("close-button"));

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnCloseAvatarOptions).not.toHaveBeenCalled();
    });
  });
});
