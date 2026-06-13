import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import {AchievementReward, ModalReward, RewardFactory} from "../RewardFactory";

jest.mock("../../../../assets/images/coin.svg", () => "CoinSvg");

describe("RewardFactory", () => {
  it("creates the modal and achievement reward variants", () => {
    const modalRender = render(<ModalReward amount={50} />);
    expect(modalRender.getByTestId("modal-reward-chest")).toBeTruthy();
    modalRender.unmount();

    const achievementRender = render(<AchievementReward amount={25} />);
    expect(achievementRender.getByTestId("reward-chest-achievement")).toBeTruthy();
  });

  it("creates reusable reward components through the factory", () => {
    const CustomAchievementReward = RewardFactory.create("achievement");
    const {getByTestId} = render(<CustomAchievementReward amount={25} testID="custom-chest" />);

    expect(getByTestId("custom-chest")).toBeTruthy();
  });

  it("handles a press without throwing", () => {
    const {getByTestId} = render(<ModalReward amount={50} />);
    const chest = getByTestId("modal-reward-chest");

    expect(() => fireEvent.press(chest)).not.toThrow();
  });

  it("renders coin costs and balances without a reward chest", () => {
    const {getByText, getByTestId, queryByTestId} = render(
      <ModalReward amount={-10} totalCoins={40} testID="coin-cost" />,
    );

    expect(getByText(/10/)).toBeTruthy();
    expect(getByTestId("coin-cost-total").props.children).toBe(40);
    expect(queryByTestId("coin-cost-chest")).toBeNull();
  });

  it("includes streak progress in summary rewards", () => {
    const {getByTestId} = render(<ModalReward amount={20} totalCoins={120} streakValue={7} />);

    expect(getByTestId("streak-counter").props.accessibilityValue.now).toBe(7);
  });
});
