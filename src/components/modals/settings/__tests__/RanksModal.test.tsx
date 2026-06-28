import React from "react";
import {render} from "@testing-library/react-native";
import RanksModal from "../RanksModal";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return {
    MaterialCommunityIcons: ({name}: {name: string}) => React.createElement(Text, null, name),
  };
});

jest.mock("../../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../../assets/images/home-bg.svg", () => "HomeBgSvg");

describe("RanksModal", () => {
  it("shows every rank and marks the current tier", () => {
    const {getByText, getByTestId, queryByText} = render(<RanksModal isVisible currentLevel={10} onClose={jest.fn()} />);

    expect(getByText("Ranks")).toBeTruthy();
    expect(getByText("Stargazer")).toBeTruthy();
    expect(getByText("Quest Legend")).toBeTruthy();
    expect(getByText("crystal-ball")).toBeTruthy();
    expect(queryByText("lock")).toBeNull();
    expect(getByTestId("rank-row-cipherKnight").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("rank-row-oracle").props.accessibilityState.disabled).toBe(true);
  });

  it("does not render rank content while hidden", () => {
    const {queryByText} = render(<RanksModal isVisible={false} currentLevel={10} onClose={jest.fn()} />);

    expect(queryByText("Ranks")).toBeNull();
  });
});
