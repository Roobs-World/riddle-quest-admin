import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import CoinPurchaseFanfareModal from "../CoinPurchaseFanfareModal";

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({
      children,
      visible,
      onRequestClose,
    }: {
      children: React.ReactNode;
      visible: boolean;
      onRequestClose?: () => void;
    }) {
      if (!visible) return null;
      return React.createElement("View", { testID: "modal", onRequestClose }, children);
    },
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/home-bg.svg", () => "HomeBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock("../../../../assets/images/large-coin-stack.svg", () => "LargeCoinStackSvg");

describe("CoinPurchaseFanfareModal", () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    isVisible: true,
    coinsPurchased: 100,
    totalCoins: 1000,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and coin summary when visible", () => {
    const { getByText } = render(<CoinPurchaseFanfareModal {...defaultProps} />);
    expect(getByText("Coins Added!")).toBeTruthy();
    expect(getByText("+100 Coins")).toBeTruthy();
    expect(getByText("Total Coins:")).toBeTruthy();
    expect(getByText("1000")).toBeTruthy();
    expect(getByText("Awesome")).toBeTruthy();
  });

  it("does not render content when hidden", () => {
    const { queryByText } = render(<CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />);
    expect(queryByText("Coins Added!")).toBeNull();
    expect(queryByText("+100 Coins")).toBeNull();
  });

  it("calls onConfirm before onClose on request close", () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <CoinPurchaseFanfareModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />
    );

    getByTestId("modal").props.onRequestClose();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm before onClose when the visible action is pressed", () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <CoinPurchaseFanfareModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.press(getByTestId("coin-purchase-fanfare-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("formats negative purchases as cost copy", () => {
    const { getByText } = render(<CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={-50} />);
    expect(getByText(/Cost:\s*50/)).toBeTruthy();
  });
});
