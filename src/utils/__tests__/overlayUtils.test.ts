import { checkAnyOverlayVisible } from "../overlayUtils";

describe("overlayUtils", () => {
  describe("checkAnyOverlayVisible", () => {
    it("should return false when all overlays are hidden", () => {
      const result = checkAnyOverlayVisible(
        false,
        false,
        false,
        false,
        false,
        false
      );
      expect(result).toBe(false);
    });

    it("should return true when instructions overlay is visible", () => {
      const result = checkAnyOverlayVisible(
        true,
        false,
        false,
        false,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when full profile details overlay is visible", () => {
      const result = checkAnyOverlayVisible(
        false,
        true,
        false,
        false,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when coin shop modal is visible", () => {
      const result = checkAnyOverlayVisible(
        false,
        false,
        true,
        false,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when watch ad modal is visible", () => {
      const result = checkAnyOverlayVisible(
        false,
        false,
        false,
        true,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when welcome overlay is visible", () => {
      const result = checkAnyOverlayVisible(
        false,
        false,
        false,
        false,
        true,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when credits overlay is visible", () => {
      const result = checkAnyOverlayVisible(
        false,
        false,
        false,
        false,
        false,
        true
      );
      expect(result).toBe(true);
    });

    it("should return true when multiple overlays are visible", () => {
      const result = checkAnyOverlayVisible(
        true,
        true,
        false,
        false,
        false,
        false
      );
      expect(result).toBe(true);
    });

    it("should return true when all overlays are visible", () => {
      const result = checkAnyOverlayVisible(true, true, true, true, true, true);
      expect(result).toBe(true);
    });

    it("should handle mixed boolean values correctly", () => {
      expect(
        checkAnyOverlayVisible(true, false, false, false, false, false)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, true, false, false, false, false)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, false, true, false, false, false)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, false, false, true, false, false)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, false, false, false, true, false)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, false, false, false, false, true)
      ).toBe(true);
      expect(
        checkAnyOverlayVisible(false, false, false, false, false, false)
      ).toBe(false);
    });

    it("should work with edge case combinations", () => {
      const edgeCases = [
        [true, true, true, false, false, false],
        [false, false, false, true, true, false],
        [true, false, true, false, true, false],
        [false, true, false, true, false, false],
        [false, false, false, false, false, true],
      ];

      edgeCases.forEach(([a, b, c, d, e, f]) => {
        const result = checkAnyOverlayVisible(a, b, c, d, e, f);
        expect(result).toBe(true);
      });
    });
  });
});
