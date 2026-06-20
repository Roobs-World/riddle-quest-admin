import React from "react";
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

  it("renders welcome content when visible", () => {
    const {getByText} = render(<WelcomeModal isVisible={true} onClose={mockOnClose} />);

    expect(getByText(t("WelcomeModal.SOLVE_RIDDLES_TEXT"))).toBeTruthy();
    expect(getByText(t("WelcomeModal.EARN_COINS_TEXT"))).toBeTruthy();
  });

  it("keeps the welcome copy close to the logo", () => {
    const {getByTestId} = render(<WelcomeModal isVisible={true} onClose={mockOnClose} />);

    expect(getByTestId("welcome-modal-copy-block").props.style.marginTop).toBeLessThan(150);
  });

  it("renders onboarding progress when provided", () => {
    const {getByTestId, queryByText} = render(
      <WelcomeModal isVisible={true} onClose={mockOnClose} onboardingProgress={{current: 1, total: 3}} />,
    );

    expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
    expect(queryByText("1/3")).toBeNull();
  });

  it("does not render content when not visible", () => {
    const {queryByText} = render(<WelcomeModal isVisible={false} onClose={mockOnClose} />);

    expect(queryByText(t("WelcomeModal.SOLVE_RIDDLES_TEXT"))).toBeNull();
  });

  it("fires dismiss callbacks when the welcome modal is tapped", () => {
    const mockOnDismiss = jest.fn();
    const {getByTestId} = render(<WelcomeModal isVisible={true} onClose={mockOnClose} onDismiss={mockOnDismiss} />);

    fireEvent.press(getByTestId("welcome-modal-touch-target"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
