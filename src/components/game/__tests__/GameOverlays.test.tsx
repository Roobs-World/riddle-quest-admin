jest.mock("../../modals", () => ({
  VictoryModal: "VictoryModalMock",
  LossModal: "LossModalMock",
  HintModal: "HintModalMock",
  SkipModal: "SkipModalMock",
}));

import {VictoryModal, LossModal, HintModal, SkipModal} from "../GameOverlays";

describe("GameOverlays", () => {
  it("re-exports expected modal components", () => {
    expect(VictoryModal).toBe("VictoryModalMock");
    expect(LossModal).toBe("LossModalMock");
    expect(HintModal).toBe("HintModalMock");
    expect(SkipModal).toBe("SkipModalMock");
  });
});
