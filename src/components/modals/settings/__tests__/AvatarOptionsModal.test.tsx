import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AvatarOptionsModal from "../AvatarOptionsModal";
import { Alert } from "react-native";

jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

// Mock ImagePicker
const mockLaunchImageLibrary = jest.fn();
jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: mockLaunchImageLibrary,
}));

// Mock Firebase Storage
const mockPutFile = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockStorageRef = {
  putFile: mockPutFile,
  getDownloadURL: mockGetDownloadURL,
};

jest.mock("@react-native-firebase/storage", () => ({
  getStorage: () => ({
    ref: () => mockStorageRef,
  }),
}));

// Mock Firebase Auth
const mockGetAuth = jest.fn(() => ({
  currentUser: {
    providerData: [
      {
        providerId: "facebook.com",
        photoURL: "https://facebook.com/photo.jpg",
      },
    ],
  },
}));

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: jest.fn().mockImplementation(mockGetAuth),
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

// Mock responsive/styles/ModalBg
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

// Mock WideButton
jest.mock("../../../buttons/WideButton", () => {
  const MockWideButton = ({
    buttonText,
    onPress,
  }: {
    buttonText: string;
    onPress: () => void;
  }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity
        onPress={onPress}
        testID={`wide-button-${buttonText.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
  return MockWideButton;
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

describe("AvatarOptionsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnOpenPreloadedAvatars = jest.fn();
  const userId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-bind getAuth since clearAllMocks() removes the mockImplementation set in jest.mock factory
    const { getAuth } = require("@react-native-firebase/auth");
    (getAuth as jest.Mock).mockImplementation(mockGetAuth);
    mockGetAuth.mockReturnValue({
      currentUser: {
        providerData: [
          {
            providerId: "facebook.com",
            photoURL: "https://facebook.com/photo.jpg",
          },
        ],
      },
    });
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: "file://test-image.jpg" }],
    });
    mockPutFile.mockReturnValue(
      Object.assign(Promise.resolve(), { on: jest.fn() })
    );
    mockGetDownloadURL.mockResolvedValue("https://storage.com/avatar.jpg");
    mockUpdatePlayerData.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render the modal when visible is true", () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      expect(getByTestId("mock-modal")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <AvatarOptionsModal
          isVisible={false}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      expect(queryByText("Update Avatar")).toBeNull();
    });

    it("should display all avatar options", () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      expect(getByTestId("wide-button-upload-from-photo-library")).toBeTruthy();
      expect(getByTestId("wide-button-choose-from-our-avatars")).toBeTruthy();
      expect(getByTestId("wide-button-use-facebook-photo")).toBeTruthy();
    });

    it("should not show Facebook option when no Facebook photo is available", () => {
      mockGetAuth.mockReturnValue({
        currentUser: {
          providerData: [],
        },
      });

      const { queryByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      expect(queryByTestId("wide-button-use-facebook-photo")).toBeNull();
    });
  });

  describe("User Interaction", () => {
    it("should close modal when close button is pressed", () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should open preloaded avatars modal when choose from avatars is pressed", () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-choose-from-our-avatars"));
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnOpenPreloadedAvatars).toHaveBeenCalled();
    });
  });

  describe("Avatar Upload Flow", () => {
    it("should close modal and initiate upload from photo library", async () => {
      const { getByText } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByText("Upload from Photo Library"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle cancelled image picker", async () => {
      mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });

      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-upload-from-photo-library"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle image picker errors", async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        errorMessage: "Permission denied",
      });

      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-upload-from-photo-library"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe("Facebook Avatar Flow", () => {
    it("should successfully use Facebook photo", async () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-use-facebook-photo"));

      await waitFor(() => {
        expect(mockUpdatePlayerData).toHaveBeenCalledWith({
          avatarUrl: "https://facebook.com/photo.jpg",
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Avatar updated to Facebook photo!"
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should handle errors when setting Facebook avatar", async () => {
      mockUpdatePlayerData.mockRejectedValue(new Error("Update failed"));

      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-use-facebook-photo"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Could not set Facebook avatar. Please try again."
        );
      });
    });
  });
});
