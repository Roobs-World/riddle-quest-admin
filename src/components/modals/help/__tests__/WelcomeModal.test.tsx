import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import WelcomeModal from "../WelcomeModal";
import {AppStrings} from "../../../../constants/AppStrings";

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

    expect(getByText(AppStrings.WelcomeModal.WELCOME_TITLE)).toBeTruthy();
    expect(getByText(AppStrings.WelcomeModal.SOLVE_RIDDLES_TEXT)).toBeTruthy();
    expect(getByText(AppStrings.WelcomeModal.EARN_COINS_TEXT)).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    const {queryByText} = render(<WelcomeModal isVisible={false} onClose={mockOnClose} />);

    expect(queryByText(AppStrings.WelcomeModal.WELCOME_TITLE)).toBeNull();
  });

  it("fires dismiss callbacks when the welcome modal is tapped", () => {
    const mockOnDismiss = jest.fn();
    const {getByTestId} = render(
      <WelcomeModal isVisible={true} onClose={mockOnClose} onDismiss={mockOnDismiss} />,
    );

    fireEvent.press(getByTestId("welcome-modal-touch-target"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
