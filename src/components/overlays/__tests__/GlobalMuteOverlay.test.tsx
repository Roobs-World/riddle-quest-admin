import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import GlobalMuteOverlay from "../GlobalMuteOverlay";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SoundManager } from "../../../services/SoundManager";

jest.mock("../../../components/buttons/MuteButton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockMuteButton({ isMuted, onToggle }: any) {
    return React.createElement(View, {
      testID: "global-mute-button",
      onPress: onToggle,
      "data-muted": isMuted,
    });
  };
});

jest.mock("../../../services/SoundManager", () => ({
  SoundManager: {
    getSoundEnabled: jest.fn(() => true),
    setSoundEnabled: jest.fn(),
    playBackgroundMusic: jest.fn(() => Promise.resolve()),
    pauseBackgroundMusic: jest.fn(() => Promise.resolve()),
  },
}));

describe("GlobalMuteOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders one persistent mute button", () => {
    const { getByTestId, queryAllByTestId } = render(<GlobalMuteOverlay />);

    expect(getByTestId("global-mute-button")).toBeTruthy();
    expect(queryAllByTestId("global-mute-button")).toHaveLength(1);
  });

  it("toggles sound and persists preference", async () => {
    const { getByTestId } = render(<GlobalMuteOverlay />);

    fireEvent.press(getByTestId("global-mute-button"));

    await waitFor(() => {
      expect(SoundManager.setSoundEnabled).toHaveBeenCalledWith(false);
      expect(SoundManager.pauseBackgroundMusic).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "isSoundEnabled",
        "false"
      );
    });
  });
});
