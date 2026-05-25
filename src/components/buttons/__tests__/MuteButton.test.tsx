import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import MuteButton from "../MuteButton";

jest.mock("react-native-vector-icons/MaterialCommunityIcons", () => {
  const React = require("react");
  const {View} = require("react-native");

  const MockMaterialCommunityIcons = ({name, size, color}: any) => (
    <View testID="mute-button-icon" data-name={name} data-size={size} data-color={color} />
  );

  MockMaterialCommunityIcons.displayName = "MockMaterialCommunityIcons";
  return MockMaterialCommunityIcons;
});

describe("MuteButton", () => {
  it("renders unmuted icon and label", () => {
    const {getByTestId, getByLabelText} = render(<MuteButton isMuted={false} onToggle={jest.fn()} />);

    expect(getByLabelText("Mute sound")).toBeTruthy();
    expect(getByTestId("mute-button-icon").props["data-name"]).toBe("volume-high");
  });

  it("renders muted icon and label", () => {
    const {getByTestId, getByLabelText} = render(<MuteButton isMuted={true} onToggle={jest.fn()} />);

    expect(getByLabelText("Unmute sound")).toBeTruthy();
    expect(getByTestId("mute-button-icon").props["data-name"]).toBe("volume-off");
  });

  it("calls onToggle when pressed", () => {
    const onToggle = jest.fn();
    const {getByTestId} = render(<MuteButton isMuted={false} onToggle={onToggle} />);

    fireEvent.press(getByTestId("mute-button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
