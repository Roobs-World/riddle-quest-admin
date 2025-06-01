import { checkAnyOverlayVisible } from "../overlayUtils";

describe("overlayUtils", () => {
  describe("checkAnyOverlayVisible", () => {
    it("should return false when all overlays are hidden", () => {
      const result = checkAnyOverlayVisible(false, false, false, false, false);
      expect(result).toBe(false);
    });

    it("should return true when isVictoryModalVisible is true", () => {
      const result = checkAnyOverlayVisible(true, false, false, false, false);
      expect(result).toBe(true);
    });

    it("should return true when isInstructionsVisible is true", () => {
      const result = checkAnyOverlayVisible(false, true, false, false, false);
      expect(result).toBe(true);
    });

    it("should return true when isFullProfileDetailsOverlayVisible is true", () => {
      const result = checkAnyOverlayVisible(false, false, true, false, false);
      expect(result).toBe(true);
    });

    it("should return true when isCoinShopModalVisible is true", () => {
      const result = checkAnyOverlayVisible(false, false, false, true, false);
      expect(result).toBe(true);
    });

    it("should return true when isWatchAdModalVisible is true", () => {
      const result = checkAnyOverlayVisible(false, false, false, false, true);
      expect(result).toBe(true);
    });

    it("should return true when multiple overlays are visible", () => {
      const result = checkAnyOverlayVisible(true, true, false, false, false);
      expect(result).toBe(true);
    });
  });
});
