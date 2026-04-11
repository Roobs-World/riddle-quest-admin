import React from "react";
import { render } from "@testing-library/react-native";
import TwitterXIcon from "../TwitterXIcon";

jest.mock("../../../../assets/images/twitter-x.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockTwitterSvg(props: any) {
    return React.createElement(View, { testID: "twitter-x-svg", ...props });
  };
});

describe("TwitterXIcon", () => {
  it("renders without dimensions", () => {
    const { getByTestId } = render(<TwitterXIcon />);
    const icon = getByTestId("twitter-x-svg");
    expect(icon.props.width).toBeUndefined();
    expect(icon.props.height).toBeUndefined();
  });

  it("forwards width and height", () => {
    const { getByTestId } = render(<TwitterXIcon width={32} height="40" />);
    const icon = getByTestId("twitter-x-svg");
    expect(icon.props.width).toBe(32);
    expect(icon.props.height).toBe("40");
  });
});
