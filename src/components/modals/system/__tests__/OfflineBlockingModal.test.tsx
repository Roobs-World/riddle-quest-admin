import React from "react";
import { render } from "@testing-library/react-native";
import { Modal } from "react-native";
import OfflineBlockingModal from "../OfflineBlockingModal";

describe("OfflineBlockingModal", () => {
  it("uses shared content animation instead of native modal animation", () => {
    const { UNSAFE_getByType, getByText } = render(
      <OfflineBlockingModal isVisible />
    );

    const modal = UNSAFE_getByType(Modal);

    expect(modal.props.animationType).toBe("none");
    expect(getByText("No Internet Connection")).toBeTruthy();
    expect(getByText("Please reconnect to continue playing.")).toBeTruthy();
  });
});
