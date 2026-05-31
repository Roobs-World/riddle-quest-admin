import React from "react";
import {fireEvent, render, waitFor} from "@testing-library/react-native";
import UpgradeAccountModal from "../UpgradeAccountModal";
import {logger} from "@/utils/logger";
import {captureException} from "@/utils/sentry";

const mockShowInfoModal = jest.fn();
const mockLinkAnonymousWithGoogle = jest.fn();
const mockLinkAnonymousWithFacebook = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/hooks/useModal", () => ({
  useModal: () => ({
    showInfoModal: mockShowInfoModal,
  }),
}));

jest.mock("../../../../application/auth/authErrorMessages", () => ({
  isGoogleSignInCancellation: (error: unknown) =>
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/auth-popup-closed-by-user") ||
    (error instanceof Error && error.message === "Google sign-in cancelled by user."),
  isFacebookLoginCancellation: (error: unknown) =>
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/auth-popup-closed-by-user") ||
    (error instanceof Error && error.message === "User cancelled the login process"),
  isAccountAlreadyInUseError: (error: unknown) =>
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      [
        "auth/credential-already-in-use",
        "auth/email-already-in-use",
        "auth/account-exists-with-different-credential",
      ].includes(error.code)) ||
    (typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("credential is already associated")),
}));

jest.mock("@/services/AuthService", () => ({
  AuthService: {
    linkAnonymousWithGoogle: (...args: unknown[]) => mockLinkAnonymousWithGoogle(...args),
    linkAnonymousWithFacebook: (...args: unknown[]) => mockLinkAnonymousWithFacebook(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("@/utils/sentry", () => ({
  captureException: jest.fn(),
}));

jest.mock("@/components/buttons/GoogleSignInButton", () => {
  const React = require("react");
  const {TouchableOpacity, Text} = require("react-native");
  return function MockGoogleSignInButton({onPress, disabled}: {onPress: () => void; disabled?: boolean}) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Text>Continue with Google</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("@/components/buttons/FacebookSignInButton", () => {
  const React = require("react");
  const {TouchableOpacity, Text} = require("react-native");
  return function MockFacebookSignInButton({onPress, disabled}: {onPress: () => void; disabled?: boolean}) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Text>Continue with Facebook</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("@/components/buttons/CloseButton", () => {
  const React = require("react");
  const {TouchableOpacity, Text} = require("react-native");
  return function MockCloseButton({onPress}: {onPress: () => void}) {
    return (
      <TouchableOpacity onPress={onPress}>
        <Text>Close</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("@/components/loading/PulsingSpinner", () => {
  const React = require("react");
  return function MockPulsingSpinner() {
    return null;
  };
});

jest.mock("@/components/shared/SlideInModalContent", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockSlideInModalContent({children}: {children: React.ReactNode}) {
    return <View>{children}</View>;
  };
});

describe("<UpgradeAccountModal />", () => {
  const defaultProps = {
    isVisible: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLinkAnonymousWithGoogle.mockResolvedValue({});
    mockLinkAnonymousWithFacebook.mockResolvedValue({});
    mockLogout.mockResolvedValue(undefined);
  });

  it("can open the existing-account prompt after the parent modal is visible", async () => {
    const {getByText} = render(<UpgradeAccountModal {...defaultProps} initialExistingAccountPromptVisible={true} />);

    await waitFor(() => {
      expect(getByText("Account already exists")).toBeTruthy();
      expect(getByText("Cancel")).toBeTruthy();
      expect(getByText("Logout")).toBeTruthy();
    });
  });

  it("shows existing-account logout modal when Google link returns an in-use account error", async () => {
    mockLinkAnonymousWithGoogle.mockRejectedValue({
      code: "auth/credential-already-in-use",
      message: "credential already in use",
    });

    const {getByText} = render(<UpgradeAccountModal {...defaultProps} />);

    fireEvent.press(getByText("Continue with Google"));

    await waitFor(() => {
      expect(getByText("Account already exists")).toBeTruthy();
      expect(
        getByText("That account already exists. Would you like to log out and sign in with it instead?"),
      ).toBeTruthy();
    });
  });

  it("shows existing-account logout modal when Facebook link returns an in-use account error", async () => {
    mockLinkAnonymousWithFacebook.mockRejectedValue({
      code: "auth/credential-already-in-use",
      message: "credential already in use",
    });

    const {getByText} = render(<UpgradeAccountModal {...defaultProps} />);

    fireEvent.press(getByText("Continue with Facebook"));

    await waitFor(() => {
      expect(getByText("Account already exists")).toBeTruthy();
      expect(
        getByText("That account already exists. Would you like to log out and sign in with it instead?"),
      ).toBeTruthy();
    });
  });

  it("does not log or alert when Facebook account linking is cancelled", async () => {
    mockLinkAnonymousWithFacebook.mockRejectedValue({
      code: "auth/auth-popup-closed-by-user",
      message: "Popup closed",
    });

    const onClose = jest.fn();
    const {getByText, queryByText} = render(<UpgradeAccountModal {...defaultProps} onClose={onClose} />);

    fireEvent.press(getByText("Continue with Facebook"));

    await waitFor(() => {
      expect(mockLinkAnonymousWithFacebook).toHaveBeenCalledTimes(1);
    });

    expect(queryByText("Account already exists")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShowInfoModal).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not log or alert when Google account linking is cancelled", async () => {
    mockLinkAnonymousWithGoogle.mockRejectedValue({
      code: "auth/auth-popup-closed-by-user",
      message: "Popup closed",
    });

    const onClose = jest.fn();
    const {getByText, queryByText} = render(<UpgradeAccountModal {...defaultProps} onClose={onClose} />);

    fireEvent.press(getByText("Continue with Google"));

    await waitFor(() => {
      expect(mockLinkAnonymousWithGoogle).toHaveBeenCalledTimes(1);
    });

    expect(queryByText("Account already exists")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShowInfoModal).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("shows existing-account logout modal when only message contains bracketed auth code", async () => {
    mockLinkAnonymousWithGoogle.mockRejectedValue({
      message: "[auth/credential-already-in-use] This credential is already associated with a different user account.",
    });

    const {getByText} = render(<UpgradeAccountModal {...defaultProps} />);

    fireEvent.press(getByText("Continue with Google"));

    await waitFor(() => {
      expect(getByText("Account already exists")).toBeTruthy();
    });
  });

  it("logs out and closes when user confirms logout in existing-account modal", async () => {
    mockLinkAnonymousWithGoogle.mockRejectedValue({
      code: "auth/credential-already-in-use",
      message: "credential already in use",
    });

    const onClose = jest.fn();
    const {getByText} = render(<UpgradeAccountModal {...defaultProps} onClose={onClose} />);

    fireEvent.press(getByText("Continue with Google"));

    await waitFor(() => {
      expect(getByText("Logout")).toBeTruthy();
    });

    fireEvent.press(getByText("Logout"));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("dismisses existing-account modal when user taps cancel", async () => {
    mockLinkAnonymousWithGoogle.mockRejectedValue({
      code: "auth/credential-already-in-use",
      message: "credential already in use",
    });

    const {getByText, queryByText} = render(<UpgradeAccountModal {...defaultProps} />);

    fireEvent.press(getByText("Continue with Google"));

    await waitFor(() => {
      expect(getByText("Cancel")).toBeTruthy();
    });

    fireEvent.press(getByText("Cancel"));

    await waitFor(() => {
      expect(queryByText("Account already exists")).toBeNull();
    });
  });
});
