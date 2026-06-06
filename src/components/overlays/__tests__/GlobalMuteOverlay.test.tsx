import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import GlobalMuteOverlay from "../GlobalMuteOverlay";

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({children, visible}: any) {
      if (!visible) return null;
      return React.createElement(React.Fragment, null, children);
    },
  };
});

jest.mock("../../../components/buttons/MuteButton", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockMuteButton({isMuted, onToggle}: any) {
    return React.createElement(View, {
      testID: "global-mute-button",
      onPress: onToggle,
      "data-muted": isMuted,
    });
  };
});

describe("GlobalMuteOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders one persistent mute button", () => {
    const {getByTestId, queryAllByTestId} = render(
      <GlobalMuteOverlay isSoundEnabled={true} onToggleSound={jest.fn()} />,
    );

    expect(getByTestId("global-mute-button")).toBeTruthy();
    expect(queryAllByTestId("global-mute-button")).toHaveLength(1);
  });

  it("calls onToggleSound with the inverse sound state", () => {
    const onToggleSound = jest.fn();
    const {getByTestId} = render(<GlobalMuteOverlay isSoundEnabled={true} onToggleSound={onToggleSound} />);

    fireEvent.press(getByTestId("global-mute-button"));

    expect(onToggleSound).toHaveBeenCalledWith(false);
  });

  it("reflects mute state from the shared sound prop", () => {
    const {getByTestId, rerender} = render(<GlobalMuteOverlay isSoundEnabled={true} onToggleSound={jest.fn()} />);

    expect(getByTestId("global-mute-button").props["data-muted"]).toBe(false);

    rerender(<GlobalMuteOverlay isSoundEnabled={false} onToggleSound={jest.fn()} />);
    expect(getByTestId("global-mute-button").props["data-muted"]).toBe(true);
  });
});
