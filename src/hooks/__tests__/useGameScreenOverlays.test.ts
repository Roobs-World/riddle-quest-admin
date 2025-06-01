import { renderHook, act } from "@testing-library/react-native";
import useGameScreenOverlays from "../useGameScreenOverlays";

describe("useGameScreenOverlays", () => {
  it("should initialize with all overlays hidden", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    expect(result.current.isVictoryModalVisible).toBe(false);
    expect(result.current.isLossModalVisible).toBe(false);
    expect(result.current.isHintOverlayVisible).toBe(false);
    expect(result.current.isHomeOverlayVisible).toBe(false);
    expect(result.current.isPlayOverlayVisible).toBe(false);
    expect(result.current.isProfileOverlayVisible).toBe(false);
    expect(result.current.isSettingsOverlayVisible).toBe(false);
  });

  it("should update isVictoryModalVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsVictoryModalVisible(true);
    });
    expect(result.current.isVictoryModalVisible).toBe(true);
    act(() => {
      result.current.setIsVictoryModalVisible(false);
    });
    expect(result.current.isVictoryModalVisible).toBe(false);
  });

  it("should update isLossModalVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsLossModalVisible(true);
    });
    expect(result.current.isLossModalVisible).toBe(true);
  });

  it("should update isHintOverlayVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsHintOverlayVisible(true);
    });
    expect(result.current.isHintOverlayVisible).toBe(true);
  });

  it("should update isHomeOverlayVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsHomeOverlayVisible(true);
    });
    expect(result.current.isHomeOverlayVisible).toBe(true);
  });

  it("should update isPlayOverlayVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsPlayOverlayVisible(true);
    });
    expect(result.current.isPlayOverlayVisible).toBe(true);
  });

  it("should update isProfileOverlayVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsProfileOverlayVisible(true);
    });
    expect(result.current.isProfileOverlayVisible).toBe(true);
  });

  it("should update isSettingsOverlayVisible", () => {
    const { result } = renderHook(() => useGameScreenOverlays());
    act(() => {
      result.current.setIsSettingsOverlayVisible(true);
    });
    expect(result.current.isSettingsOverlayVisible).toBe(true);
  });
});
