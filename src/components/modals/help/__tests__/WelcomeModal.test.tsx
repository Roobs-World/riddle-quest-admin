import React from "react";
import {act} from "react-test-renderer";
import {render, fireEvent} from "@testing-library/react-native";
import WelcomeModal from "../WelcomeModal";
import {t} from "../../../../i18n";

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/home-bg.svg", () => "HomeBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock("../../../../assets/images/main-logo.svg", () => "LogoSvg");

describe("WelcomeModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("renders welcome content when visible", () => {
    const {getByText} = render(<WelcomeModal isVisible={true} onClose={mockOnClose} />);

    expect(getByText(t("WelcomeModal.WELCOME_TITLE"))).toBeTruthy();
    expect(getByText(t("WelcomeModal.SOLVE_RIDDLES_TEXT"))).toBeTruthy();
    expect(getByText(t("WelcomeModal.EARN_COINS_TEXT"))).toBeTruthy();
  });

  it("renders onboarding progress when provided", () => {
    const {getByText, getByTestId} = render(
      <WelcomeModal isVisible={true} onClose={mockOnClose} onboardingProgress={{current: 1, total: 3}} />,
    );

    expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
    expect(getByText("1/3")).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    const {queryByText} = render(<WelcomeModal isVisible={false} onClose={mockOnClose} />);

    expect(queryByText(t("WelcomeModal.WELCOME_TITLE"))).toBeNull();
  });

  it("fires dismiss callbacks when the welcome modal is tapped", () => {
    const mockOnDismiss = jest.fn();
    const {getByTestId} = render(<WelcomeModal isVisible={true} onClose={mockOnClose} onDismiss={mockOnDismiss} />);

    fireEvent.press(getByTestId("welcome-modal-touch-target"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses when shown in development mode", async () => {
    const mockOnDismiss = jest.fn();
    render(<WelcomeModal isVisible={true} onClose={mockOnClose} onDismiss={mockOnDismiss} />);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
