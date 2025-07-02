import type {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../OverlayTypes";

describe("OverlayTypes", () => {
  it("should define GameScreenOverlayState interface correctly", () => {
    const overlayState: GameScreenOverlayState = {
      isVictoryModalVisible: false,
      isLossModalVisible: false,
      isHintOverlayVisible: false,
      isHomeOverlayVisible: true,
      isPlayOverlayVisible: false,
      isProfileOverlayVisible: false,
      isSettingsOverlayVisible: false,
    };

    expect(typeof overlayState.isVictoryModalVisible).toBe("boolean");
    expect(typeof overlayState.isLossModalVisible).toBe("boolean");
    expect(typeof overlayState.isHintOverlayVisible).toBe("boolean");
    expect(typeof overlayState.isHomeOverlayVisible).toBe("boolean");
    expect(typeof overlayState.isPlayOverlayVisible).toBe("boolean");
    expect(typeof overlayState.isProfileOverlayVisible).toBe("boolean");
    expect(typeof overlayState.isSettingsOverlayVisible).toBe("boolean");

    expect(overlayState.isHomeOverlayVisible).toBe(true);
    expect(overlayState.isVictoryModalVisible).toBe(false);
  });

  it("should define GameScreenOverlayActions interface correctly", () => {
    const mockActions: GameScreenOverlayActions = {
      setIsVictoryModalVisible: jest.fn(),
      setIsLossModalVisible: jest.fn(),
      setIsHintOverlayVisible: jest.fn(),
      setIsHomeOverlayVisible: jest.fn(),
      setIsPlayOverlayVisible: jest.fn(),
      setIsProfileOverlayVisible: jest.fn(),
      setIsSettingsOverlayVisible: jest.fn(),
    };

    expect(typeof mockActions.setIsVictoryModalVisible).toBe("function");
    expect(typeof mockActions.setIsLossModalVisible).toBe("function");
    expect(typeof mockActions.setIsHintOverlayVisible).toBe("function");
    expect(typeof mockActions.setIsHomeOverlayVisible).toBe("function");
    expect(typeof mockActions.setIsPlayOverlayVisible).toBe("function");
    expect(typeof mockActions.setIsProfileOverlayVisible).toBe("function");
    expect(typeof mockActions.setIsSettingsOverlayVisible).toBe("function");
  });

  it("should allow calling overlay action methods with boolean parameters", () => {
    const mockActions: GameScreenOverlayActions = {
      setIsVictoryModalVisible: jest.fn(),
      setIsLossModalVisible: jest.fn(),
      setIsHintOverlayVisible: jest.fn(),
      setIsHomeOverlayVisible: jest.fn(),
      setIsPlayOverlayVisible: jest.fn(),
      setIsProfileOverlayVisible: jest.fn(),
      setIsSettingsOverlayVisible: jest.fn(),
    };

    // Test calling each action with both true and false
    mockActions.setIsVictoryModalVisible(true);
    mockActions.setIsVictoryModalVisible(false);
    mockActions.setIsLossModalVisible(true);
    mockActions.setIsHintOverlayVisible(false);
    mockActions.setIsHomeOverlayVisible(true);
    mockActions.setIsPlayOverlayVisible(false);
    mockActions.setIsProfileOverlayVisible(true);
    mockActions.setIsSettingsOverlayVisible(false);

    expect(mockActions.setIsVictoryModalVisible).toHaveBeenCalledWith(true);
    expect(mockActions.setIsVictoryModalVisible).toHaveBeenCalledWith(false);
    expect(mockActions.setIsLossModalVisible).toHaveBeenCalledWith(true);
    expect(mockActions.setIsHintOverlayVisible).toHaveBeenCalledWith(false);
    expect(mockActions.setIsHomeOverlayVisible).toHaveBeenCalledWith(true);
    expect(mockActions.setIsPlayOverlayVisible).toHaveBeenCalledWith(false);
    expect(mockActions.setIsProfileOverlayVisible).toHaveBeenCalledWith(true);
    expect(mockActions.setIsSettingsOverlayVisible).toHaveBeenCalledWith(false);
  });

  it("should allow implementing the interfaces", () => {
    class TestOverlayManager implements GameScreenOverlayActions {
      setIsVictoryModalVisible(isVisible: boolean): void {}
      setIsLossModalVisible(isVisible: boolean): void {}
      setIsHintOverlayVisible(isVisible: boolean): void {}
      setIsHomeOverlayVisible(isVisible: boolean): void {}
      setIsPlayOverlayVisible(isVisible: boolean): void {}
      setIsProfileOverlayVisible(isVisible: boolean): void {}
      setIsSettingsOverlayVisible(isVisible: boolean): void {}
    }

    const manager = new TestOverlayManager();
    expect(manager).toBeInstanceOf(TestOverlayManager);
    expect(typeof manager.setIsVictoryModalVisible).toBe("function");
  });

  it("should support all overlay state combinations", () => {
    const allVisibleState: GameScreenOverlayState = {
      isVictoryModalVisible: true,
      isLossModalVisible: true,
      isHintOverlayVisible: true,
      isHomeOverlayVisible: true,
      isPlayOverlayVisible: true,
      isProfileOverlayVisible: true,
      isSettingsOverlayVisible: true,
    };

    const allHiddenState: GameScreenOverlayState = {
      isVictoryModalVisible: false,
      isLossModalVisible: false,
      isHintOverlayVisible: false,
      isHomeOverlayVisible: false,
      isPlayOverlayVisible: false,
      isProfileOverlayVisible: false,
      isSettingsOverlayVisible: false,
    };

    const mixedState: GameScreenOverlayState = {
      isVictoryModalVisible: true,
      isLossModalVisible: false,
      isHintOverlayVisible: true,
      isHomeOverlayVisible: false,
      isPlayOverlayVisible: true,
      isProfileOverlayVisible: false,
      isSettingsOverlayVisible: true,
    };

    expect(
      Object.values(allVisibleState).every((value) => value === true)
    ).toBe(true);
    expect(
      Object.values(allHiddenState).every((value) => value === false)
    ).toBe(true);
    expect(Object.values(mixedState).some((value) => value === true)).toBe(
      true
    );
    expect(Object.values(mixedState).some((value) => value === false)).toBe(
      true
    );
  });
});
