import React from "react";
import {render} from "@testing-library/react-native";
import TreasureChest from "../TreasureChest";
import {t} from "../../../../i18n";

jest.mock("../../../../../assets/images/treasure-chest-rays.svg", () => "TreasureChestRaysSvg");
jest.mock("../../../../../assets/images/chest-open.svg", () => "TreasureChestOpenSvg");
jest.mock("../../../../qa/qaRuntime", () => ({
  isQASurfaceRuntimeActive: () => true,
}));

describe("TreasureChest", () => {
  it("renders the total coin label and supplied balance", () => {
    const {getByText} = render(<TreasureChest coins={125} />);

    expect(getByText(t("Profile.TOTAL_COINS_LABEL"))).toBeTruthy();
    expect(getByText("125")).toBeTruthy();
  });

  it("exposes the rounded chest card as the tooltip target", () => {
    const {getByTestId} = render(<TreasureChest coins={125} cardTestID="treasure-card-target" />);

    expect(getByTestId("treasure-card-target")).toBeTruthy();
  });
});
