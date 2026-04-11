import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { View, TouchableOpacity } from "react-native";
import { GameInputButton } from "../GameInputButton";
import { GAME_INPUT_BUTTON_HEIGHT } from "../../../constants/layout";
import { SPACING } from "../../../styles";

describe("GameInputButton", () => {
  it("renders icon and text", () => {
    const { getByText, getByTestId } = render(
      <GameInputButton
        text="Hint"
        icon={<View testID="button-icon" />}
        callback={jest.fn()}
      />
    );

    expect(getByTestId("button-icon")).toBeTruthy();
    expect(getByText("Hint")).toBeTruthy();
  });

  it("invokes callback when pressed", () => {
    const callback = jest.fn();
    const { getByText } = render(
      <GameInputButton
        text="Skip"
        icon={<View testID="button-icon" />}
        callback={callback}
      />
    );

    fireEvent.press(getByText("Skip"));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("applies expected container styling", () => {
    const { UNSAFE_getByType } = render(
      <GameInputButton
        text="Next"
        icon={<View testID="button-icon" />}
        callback={jest.fn()}
      />
    );

    const button = UNSAFE_getByType(TouchableOpacity);
    expect(button).toBeTruthy();
    expect(button.props.className).toContain("rounded-full");
    expect(button.props.className).toContain("bg-key-bg");
    expect(button.props.style.height).toBe(GAME_INPUT_BUTTON_HEIGHT);
    expect(button.props.style.paddingHorizontal).toBe(SPACING.md);
    expect(button.props.style.gap).toBe(SPACING.sm);
  });
});
