import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Image } from "react-native";
import PreloadedAvatarsModal from "../PreloadedAvatarsModal";
import { Alert } from "react-native";

jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

// Mock useAuth hook
const mockUpdatePlayerData = jest.fn();
jest.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    updatePlayerData: mockUpdatePlayerData,
  }),
}));

// Mock responsive and styles for PreloadedAvatarsModal
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

// Mock ModalBg (SVG)
jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function ModalBgMock(props: any) {
    return <View testID="modal-bg" {...props} />;
  };
});

// Mock WideButton
jest.mock("../../../buttons/WideButton", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  return function MockWideButton({ buttonText, onPress }: any) {
    return (
      <TouchableOpacity onPress={onPress} testID="wide-button">
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
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

describe("PreloadedAvatarsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnCloseAvatarOptions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePlayerData.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByText } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(getByText("Select Avatar")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <PreloadedAvatarsModal
          isVisible={false}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      expect(queryByText("Select Avatar")).toBeNull();
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
      const { UNSAFE_getAllByType } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      const avatarImages = UNSAFE_getAllByType(Image);
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
      const { UNSAFE_getAllByType } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      const avatarImages = UNSAFE_getAllByType(Image);
      expect(avatarImages.length).toBeGreaterThan(0);

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

      const { UNSAFE_getAllByType } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      const avatarImages = UNSAFE_getAllByType(Image);
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
      const { UNSAFE_getAllByType } = render(
        <PreloadedAvatarsModal
          isVisible={true}
          onClose={mockOnClose}
          onCloseAvatarOptions={mockOnCloseAvatarOptions}
        />
      );

      const avatarImages = UNSAFE_getAllByType(Image);
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
