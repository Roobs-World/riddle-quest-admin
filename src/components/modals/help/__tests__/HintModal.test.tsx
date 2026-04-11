import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import HintModal from "../HintModal";

jest.mock("../../../buttons/CloseButton", () => {
  const React = require("react");
  const { TouchableOpacity } = require("react-native");
  return function MockCloseButton({ onPress }: { onPress: () => void }) {
    return <TouchableOpacity testID="close-button" onPress={onPress} />;
  };
});

jest.mock("src/components/buttons/WideButton", () => {
  const React = require("react");
  const { Text, TouchableOpacity } = require("react-native");
  return function MockWideButton({
    buttonText,
    onPress,
    disabled,
  }: {
    buttonText: string;
    onPress: () => void;
    disabled: boolean;
  }) {
    return (
      <TouchableOpacity
        testID={`wide-button-${buttonText}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockModalBg() {
    return <View testID="modal-bg" />;
  };
});

describe("HintModal", () => {
  const onShowHint = jest.fn();
  const onClose = jest.fn();

  const renderModal = (props?: Partial<React.ComponentProps<typeof HintModal>>) =>
    render(
      <HintModal
        isVisible={true}
        userCoins={100}
        hintCost={50}
        onShowHint={onShowHint}
        onClose={onClose}
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and dynamic coin copy", () => {
    const { getByText, getByTestId } = renderModal({ userCoins: 250, hintCost: 75 });

    expect(getByText("Use a Hint?")).toBeTruthy();
    expect(getByText("Cost: 75 Coins. You have: 250 Coins.")).toBeTruthy();
    expect(getByTestId("modal-bg")).toBeTruthy();
  });

  it("shows insufficient-funds warning and disables SHOW HINT when user cannot afford", () => {
    const { getByText, getByTestId } = renderModal({ userCoins: 30, hintCost: 50 });

    expect(getByText("You do not have enough coins for a hint.")).toBeTruthy();
    expect(getByTestId("wide-button-SHOW HINT").props.accessibilityState.disabled).toBe(
      true
    );
  });

  it("hides warning and enables SHOW HINT when user can afford exact cost", () => {
    const { queryByText, getByTestId } = renderModal({ userCoins: 50, hintCost: 50 });

    expect(queryByText("You do not have enough coins for a hint.")).toBeNull();
    expect(getByTestId("wide-button-SHOW HINT").props.accessibilityState.disabled).toBe(
      false
    );
  });

  it("closes and then triggers hint callback when SHOW HINT is pressed", () => {
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId("wide-button-SHOW HINT"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShowHint).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      onShowHint.mock.invocationCallOrder[0]
    );
  });

  it("calls onClose from CLOSE button and close icon", () => {
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId("wide-button-CLOSE"));
    fireEvent.press(getByTestId("close-button"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
