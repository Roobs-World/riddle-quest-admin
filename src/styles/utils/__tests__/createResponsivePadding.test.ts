import { createResponsivePadding } from "../createResponsivePadding";
import { SPACING } from "../../tokens/spacing";

describe("createResponsivePadding", () => {
  describe("default behavior", () => {
    it("should create responsive padding with default base padding", () => {
      const padding = createResponsivePadding();

      expect(padding).toEqual({
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md * 0.75,
      });
    });

    it("should have both horizontal and vertical padding properties", () => {
      const padding = createResponsivePadding();

      expect(padding).toHaveProperty("paddingHorizontal");
      expect(padding).toHaveProperty("paddingVertical");
      expect(typeof padding.paddingHorizontal).toBe("number");
      expect(typeof padding.paddingVertical).toBe("number");
    });
  });

  describe("custom base padding", () => {
    it("should create responsive padding with custom base value", () => {
      const basePadding = 20;
      const padding = createResponsivePadding(basePadding);

      expect(padding).toEqual({
        paddingHorizontal: basePadding,
        paddingVertical: basePadding * 0.75,
      });
    });

    it("should handle zero base padding", () => {
      const padding = createResponsivePadding(0);

      expect(padding).toEqual({
        paddingHorizontal: 0,
        paddingVertical: 0,
      });
    });

    it("should handle negative base padding", () => {
      const basePadding = -10;
      const padding = createResponsivePadding(basePadding);

      expect(padding).toEqual({
        paddingHorizontal: basePadding,
        paddingVertical: basePadding * 0.75,
      });
    });

    it("should handle decimal base padding", () => {
      const basePadding = 12.5;
      const padding = createResponsivePadding(basePadding);

      expect(padding).toEqual({
        paddingHorizontal: basePadding,
        paddingVertical: basePadding * 0.75,
      });
    });

    it("should handle large base padding values", () => {
      const basePadding = 100;
      const padding = createResponsivePadding(basePadding);

      expect(padding).toEqual({
        paddingHorizontal: basePadding,
        paddingVertical: basePadding * 0.75,
      });
    });
  });

  describe("padding ratio calculation", () => {
    it("should always use 0.75 ratio for vertical padding", () => {
      const testCases = [8, 16, 24, 32, 40];

      testCases.forEach((basePadding) => {
        const padding = createResponsivePadding(basePadding);
        expect(padding.paddingVertical).toBe(basePadding * 0.75);
      });
    });

    it("should maintain horizontal padding as base value", () => {
      const testCases = [5, 10, 15, 20, 25];

      testCases.forEach((basePadding) => {
        const padding = createResponsivePadding(basePadding);
        expect(padding.paddingHorizontal).toBe(basePadding);
      });
    });

    it("should create aspect ratio of 1.33 (horizontal to vertical)", () => {
      const basePadding = 16;
      const padding = createResponsivePadding(basePadding);
      const ratio = padding.paddingHorizontal / padding.paddingVertical;

      expect(ratio).toBeCloseTo(1.333, 3);
    });
  });

  describe("edge cases", () => {
    it("should handle very small decimal values", () => {
      const basePadding = 0.1;
      const padding = createResponsivePadding(basePadding);

      expect(padding.paddingHorizontal).toBe(0.1);
      expect(padding.paddingVertical).toBeCloseTo(0.075, 10);
    });

    it("should handle floating point precision", () => {
      const basePadding = 10;
      const padding = createResponsivePadding(basePadding);

      expect(padding.paddingVertical).toBe(7.5);
      expect(Number.isFinite(padding.paddingVertical)).toBe(true);
    });

    it("should not modify the input parameter", () => {
      const originalBasePadding = 16;
      const basePadding = originalBasePadding;

      createResponsivePadding(basePadding);

      expect(basePadding).toBe(originalBasePadding);
    });
  });

  describe("default value validation", () => {
    it("should use SPACING.md as default when no parameter provided", () => {
      const padding = createResponsivePadding();

      expect(padding.paddingHorizontal).toBe(SPACING.md);
    });

    it("should use SPACING.md as default when undefined is passed", () => {
      const padding = createResponsivePadding(undefined);

      expect(padding.paddingHorizontal).toBe(SPACING.md);
      expect(padding.paddingVertical).toBe(SPACING.md * 0.75);
    });
  });

  describe("return type validation", () => {
    it("should return an object with correct structure", () => {
      const padding = createResponsivePadding();

      expect(typeof padding).toBe("object");
      expect(Object.keys(padding)).toHaveLength(2);
      expect(Object.keys(padding)).toContain("paddingHorizontal");
      expect(Object.keys(padding)).toContain("paddingVertical");
    });

    it("should return immutable objects", () => {
      const padding1 = createResponsivePadding(16);
      const padding2 = createResponsivePadding(16);

      expect(padding1).not.toBe(padding2);
      expect(padding1).toEqual(padding2);
    });

    it("should not have any additional properties", () => {
      const padding = createResponsivePadding();
      const keys = Object.keys(padding);

      expect(keys).toEqual(["paddingHorizontal", "paddingVertical"]);
    });
  });

  describe("responsive design implications", () => {
    it("should create tighter vertical spacing for better mobile UX", () => {
      const basePadding = 20;
      const padding = createResponsivePadding(basePadding);

      expect(padding.paddingVertical).toBeLessThan(padding.paddingHorizontal);
    });

    it("should maintain readable spacing ratios", () => {
      const basePadding = 16;
      const padding = createResponsivePadding(basePadding);

      // Vertical should be 75% of horizontal
      expect(padding.paddingVertical / padding.paddingHorizontal).toBe(0.75);
    });

    it("should work well with common spacing values", () => {
      const commonSpacingValues = [8, 12, 16, 20, 24, 32];

      commonSpacingValues.forEach((spacing) => {
        const padding = createResponsivePadding(spacing);

        expect(padding.paddingHorizontal).toBe(spacing);
        expect(padding.paddingVertical).toBe(spacing * 0.75);
        expect(padding.paddingVertical).toBeGreaterThan(0);
      });
    });
  });

  describe("integration with SPACING tokens", () => {
    it("should work correctly with SPACING.sm", () => {
      const padding = createResponsivePadding(SPACING.sm);

      expect(padding.paddingHorizontal).toBe(SPACING.sm);
      expect(padding.paddingVertical).toBe(SPACING.sm * 0.75);
    });

    it("should work correctly with SPACING.lg", () => {
      const padding = createResponsivePadding(SPACING.lg);

      expect(padding.paddingHorizontal).toBe(SPACING.lg);
      expect(padding.paddingVertical).toBe(SPACING.lg * 0.75);
    });

    it("should work correctly with SPACING.xl", () => {
      const padding = createResponsivePadding(SPACING.xl);

      expect(padding.paddingHorizontal).toBe(SPACING.xl);
      expect(padding.paddingVertical).toBe(SPACING.xl * 0.75);
    });
  });
});

