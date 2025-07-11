import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AvatarOptionsModal from "../AvatarOptionsModal";
import { Alert } from "react-native";

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
const mockCurrentUser = {
  providerData: [
    {
      providerId: "facebook.com",
      photoURL: "https://facebook.com/photo.jpg",
    },
  ],
};

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => ({
    currentUser: mockCurrentUser,
  }),
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

// Mock React Native Alert
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Alert: {
    alert: jest.fn(),
  },
}));

describe("AvatarOptionsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnOpenPreloadedAvatars = jest.fn();
  const userId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: "file://test-image.jpg" }],
    });
    mockPutFile.mockReturnValue({
      on: jest.fn(),
      then: jest.fn().mockResolvedValue(undefined),
    });
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

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByTestId } = render(
        <AvatarOptionsModal
          isVisible={false}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
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
      expect(getByTestId("wide-button-cancel")).toBeTruthy();
    });

    it("should not show Facebook option when no Facebook photo is available", () => {
      // Mock no Facebook photo
      jest
        .mocked(require("@react-native-firebase/auth"))
        .getAuth.mockReturnValue({
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
    it("should close modal when cancel button is pressed", () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      fireEvent.press(getByTestId("wide-button-cancel"));
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
    it("should successfully upload avatar from photo library", async () => {
      const { getByTestId } = render(
        <AvatarOptionsModal
          isVisible={true}
          onClose={mockOnClose}
          onOpenPreloadedAvatars={mockOnOpenPreloadedAvatars}
          userId={userId}
        />
      );

      // Mock successful upload task
      const mockTask = {
        on: jest.fn(),
        then: jest.fn().mockImplementation((callback) => {
          callback();
          return Promise.resolve();
        }),
      };
      mockPutFile.mockReturnValue(mockTask);

      fireEvent.press(getByTestId("wide-button-upload-from-photo-library"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockLaunchImageLibrary).toHaveBeenCalled();
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
