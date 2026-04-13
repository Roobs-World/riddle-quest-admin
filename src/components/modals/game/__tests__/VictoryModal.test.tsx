import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import VictoryModal from "../VictoryModal";
import type { SubmittedGuess, Feedback } from "../../../../hooks/types";

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({ children, visible }: any) {
      if (!visible) return null;
      return React.createElement("View", { testID: "modal" }, children);
    },
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/coin.svg", () => "CoinSvg");
jest.mock("../../../../assets/images/chest.svg", () => "ChestSvg");
jest.mock("../../../../assets/images/segment-bg.svg", () => "SegmentBgSvg");

describe("VictoryModal", () => {
  const mockOnNextLevel = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    isVisible: true,
    attempts: 3,
    coinsEarned: 50,
    totalCoins: 305,
    onNextLevel: mockOnNextLevel,
    onClose: mockOnClose,
    guesses: [
      {
        guess: ["H", "E", "L", "L", "O"],
        feedback: ["green", "green", "green", "green", "green"] as Feedback[],
      },
    ] as SubmittedGuess[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the updated design content", () => {
    const { getByText } = render(<VictoryModal {...defaultProps} />);

    expect(getByText("NICE JOB!")).toBeTruthy();
    expect(getByText("+50 Coins")).toBeTruthy();
    expect(getByText("Total coins")).toBeTruthy();
    expect(getByText("305")).toBeTruthy();
  });

  it("falls back to earned coins when totalCoins is not provided", () => {
    const { getByText } = render(
      <VictoryModal {...defaultProps} totalCoins={undefined} />
    );

    expect(getByText("50")).toBeTruthy();
  });

  it("advances when the modal card is pressed", async () => {
    const { getByTestId } = render(<VictoryModal {...defaultProps} />);

    fireEvent.press(getByTestId("victory-card-pressable"));

    expect(mockOnNextLevel).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
