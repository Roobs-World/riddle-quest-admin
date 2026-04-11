import React from "react";
import { render } from "@testing-library/react-native";
import CloseButtonWhite from "../CloseButtonWhite";

jest.mock("../CloseButton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockCloseButton(props: any) {
    return React.createElement(View, { testID: "close-button-proxy", ...props });
  };
});

describe("CloseButtonWhite", () => {
  it("forces white icon color while forwarding props", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <CloseButtonWhite
        onPress={onPress}
        size={30}
        className="my-class"
        testID="close-white"
      />
    );

    const button = getByTestId("close-white");
    expect(button.props.onPress).toBe(onPress);
    expect(button.props.size).toBe(30);
    expect(button.props.color).toBe("white");
    expect(button.props.className).toBe("my-class");
    expect(button.props.testID).toBe("close-white");
  });

  it("defaults className to empty string", () => {
    const { getByTestId } = render(<CloseButtonWhite onPress={jest.fn()} />);
    expect(getByTestId("close-button-proxy").props.className).toBe("");
  });
});

