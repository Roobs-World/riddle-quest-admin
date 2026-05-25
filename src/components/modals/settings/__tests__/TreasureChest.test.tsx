import React from "react";
import {render} from "@testing-library/react-native";
import TreasureChest from "../TreasureChest";
import {AppStrings} from "../../../../constants/AppStrings";

jest.mock("../../../../../assets/images/treasure-chest-rays.svg", () => "TreasureChestRaysSvg");
jest.mock("../../../../../assets/images/chest.svg", () => "TreasureChestSvg");
jest.mock("../../../../qa/qaRuntime", () => ({
  isQASurfaceRuntimeActive: () => true,
}));

describe("TreasureChest", () => {
  it("renders the total coin label and supplied balance", () => {
    const {getByText} = render(<TreasureChest coins={125} />);

    expect(getByText(AppStrings.Profile.TOTAL_COINS_LABEL)).toBeTruthy();
    expect(getByText("125")).toBeTruthy();
  });
});
