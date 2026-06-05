import React from "react";
import {act, fireEvent, render} from "@testing-library/react-native";
import WelcomeBackModal from "../WelcomeBackModal";
import {t} from "../../../../i18n";

let mockPlayerData: {avatarUrl?: string | null} | null = null;

jest.mock("../../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../../assets/images/home-bg.svg", () => "HomeBgSvg");
jest.mock("@/components/shared/RotatingWheelBackground", () => () => null);
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    playerData: mockPlayerData,
  }),
}));

describe("WelcomeBackModal", () => {
  const mockOnClose = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayerData = null;
  });

  it("renders the welcome-back copy and username", () => {
    const {getByText, getByTestId} = render(
      <WelcomeBackModal isVisible onClose={mockOnClose} onDismiss={mockOnDismiss} username="Craig" />,
    );

    expect(getByText(t("WelcomeBackModal.TITLE"))).toBeTruthy();
    expect(getByText("Craig")).toBeTruthy();
    expect(getByText(t("WelcomeBackModal.TAP_TO_CONTINUE"))).toBeTruthy();
    expect(getByTestId("welcome-back-modal-touch-target")).toBeTruthy();
  });

  it("falls back to the guest username when no username is supplied", () => {
    const {getByText} = render(<WelcomeBackModal isVisible onClose={mockOnClose} username="" />);

    expect(getByText(t("Profile.GUEST_USERNAME"))).toBeTruthy();
  });

  it("renders an avatar image when the auth profile has one", () => {
    mockPlayerData = {avatarUrl: "https://example.com/avatar.png"};

    const {getByTestId} = render(<WelcomeBackModal isVisible onClose={mockOnClose} username="Craig" />);

    expect(getByTestId("welcome-back-avatar-image")).toBeTruthy();
  });

  it("fires close and dismiss callbacks when tapped", () => {
    const {getByTestId} = render(
      <WelcomeBackModal isVisible onClose={mockOnClose} onDismiss={mockOnDismiss} username="Craig" />,
    );

    fireEvent.press(getByTestId("welcome-back-modal-touch-target"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses when shown in development mode", async () => {
    render(<WelcomeBackModal isVisible onClose={mockOnClose} onDismiss={mockOnDismiss} username="Craig" />);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
