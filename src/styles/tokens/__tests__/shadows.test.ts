import { SHADOWS } from "../shadows";
import { COLORS } from "../colors";

describe("SHADOWS", () => {
  describe("Structure", () => {
    it("exports SHADOWS object", () => {
      expect(SHADOWS).toBeDefined();
      expect(typeof SHADOWS).toBe("object");
    });

    it("contains all required shadow sizes", () => {
      expect(SHADOWS.sm).toBeDefined();
      expect(SHADOWS.md).toBeDefined();
      expect(SHADOWS.lg).toBeDefined();
      expect(SHADOWS.xl).toBeDefined();
    });
  });

  describe("Small Shadow (sm)", () => {
    it("has correct shadow properties", () => {
      expect(SHADOWS.sm.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.sm.shadowOffset).toEqual({ width: 0, height: 1 });
      expect(SHADOWS.sm.shadowOpacity).toBe(0.05);
      expect(SHADOWS.sm.shadowRadius).toBe(2);
      expect(SHADOWS.sm.elevation).toBe(1);
    });

    it("has valid shadow offset", () => {
      expect(typeof SHADOWS.sm.shadowOffset.width).toBe("number");
      expect(typeof SHADOWS.sm.shadowOffset.height).toBe("number");
      expect(SHADOWS.sm.shadowOffset.width).toBe(0);
      expect(SHADOWS.sm.shadowOffset.height).toBeGreaterThan(0);
    });
  });

  describe("Medium Shadow (md)", () => {
    it("has correct shadow properties", () => {
      expect(SHADOWS.md.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.md.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(SHADOWS.md.shadowOpacity).toBe(0.1);
      expect(SHADOWS.md.shadowRadius).toBe(3.84);
      expect(SHADOWS.md.elevation).toBe(5);
    });

    it("has larger values than small shadow", () => {
      expect(SHADOWS.md.shadowOffset.height).toBeGreaterThan(
        SHADOWS.sm.shadowOffset.height
      );
      expect(SHADOWS.md.shadowOpacity).toBeGreaterThan(
        SHADOWS.sm.shadowOpacity
      );
      expect(SHADOWS.md.shadowRadius).toBeGreaterThan(SHADOWS.sm.shadowRadius);
      expect(SHADOWS.md.elevation).toBeGreaterThan(SHADOWS.sm.elevation);
    });
  });

  describe("Large Shadow (lg)", () => {
    it("has correct shadow properties", () => {
      expect(SHADOWS.lg.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.lg.shadowOffset).toEqual({ width: 0, height: 4 });
      expect(SHADOWS.lg.shadowOpacity).toBe(0.15);
      expect(SHADOWS.lg.shadowRadius).toBe(6);
      expect(SHADOWS.lg.elevation).toBe(8);
    });

    it("has larger values than medium shadow", () => {
      expect(SHADOWS.lg.shadowOffset.height).toBeGreaterThan(
        SHADOWS.md.shadowOffset.height
      );
      expect(SHADOWS.lg.shadowOpacity).toBeGreaterThan(
        SHADOWS.md.shadowOpacity
      );
      expect(SHADOWS.lg.shadowRadius).toBeGreaterThan(SHADOWS.md.shadowRadius);
      expect(SHADOWS.lg.elevation).toBeGreaterThan(SHADOWS.md.elevation);
    });
  });

  describe("Extra Large Shadow (xl)", () => {
    it("has correct shadow properties", () => {
      expect(SHADOWS.xl.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.xl.shadowOffset).toEqual({ width: 0, height: 10 });
      expect(SHADOWS.xl.shadowOpacity).toBe(0.25);
      expect(SHADOWS.xl.shadowRadius).toBe(15);
      expect(SHADOWS.xl.elevation).toBe(15);
    });

    it("has largest values", () => {
      expect(SHADOWS.xl.shadowOffset.height).toBeGreaterThan(
        SHADOWS.lg.shadowOffset.height
      );
      expect(SHADOWS.xl.shadowOpacity).toBeGreaterThan(
        SHADOWS.lg.shadowOpacity
      );
      expect(SHADOWS.xl.shadowRadius).toBeGreaterThan(SHADOWS.lg.shadowRadius);
      expect(SHADOWS.xl.elevation).toBeGreaterThan(SHADOWS.lg.elevation);
    });
  });

  describe("Shadow Progression", () => {
    it("has progressive shadow heights", () => {
      const heights = [
        SHADOWS.sm.shadowOffset.height,
        SHADOWS.md.shadowOffset.height,
        SHADOWS.lg.shadowOffset.height,
        SHADOWS.xl.shadowOffset.height,
      ];

      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThan(heights[i - 1]);
      }
    });

    it("has progressive opacity values", () => {
      const opacities = [
        SHADOWS.sm.shadowOpacity,
        SHADOWS.md.shadowOpacity,
        SHADOWS.lg.shadowOpacity,
        SHADOWS.xl.shadowOpacity,
      ];

      for (let i = 1; i < opacities.length; i++) {
        expect(opacities[i]).toBeGreaterThan(opacities[i - 1]);
      }
    });

    it("has progressive radius values", () => {
      const radii = [
        SHADOWS.sm.shadowRadius,
        SHADOWS.md.shadowRadius,
        SHADOWS.lg.shadowRadius,
        SHADOWS.xl.shadowRadius,
      ];

      for (let i = 1; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThan(radii[i - 1]);
      }
    });

    it("has progressive elevation values", () => {
      const elevations = [
        SHADOWS.sm.elevation,
        SHADOWS.md.elevation,
        SHADOWS.lg.elevation,
        SHADOWS.xl.elevation,
      ];

      for (let i = 1; i < elevations.length; i++) {
        expect(elevations[i]).toBeGreaterThan(elevations[i - 1]);
      }
    });
  });

  describe("Consistency", () => {
    it("all shadows use the same shadow color", () => {
      expect(SHADOWS.sm.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.md.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.lg.shadowColor).toBe(COLORS.shadowColor);
      expect(SHADOWS.xl.shadowColor).toBe(COLORS.shadowColor);
    });

    it("all shadows have zero width offset", () => {
      expect(SHADOWS.sm.shadowOffset.width).toBe(0);
      expect(SHADOWS.md.shadowOffset.width).toBe(0);
      expect(SHADOWS.lg.shadowOffset.width).toBe(0);
      expect(SHADOWS.xl.shadowOffset.width).toBe(0);
    });

    it("all opacity values are between 0 and 1", () => {
      const opacities = [
        SHADOWS.sm.shadowOpacity,
        SHADOWS.md.shadowOpacity,
        SHADOWS.lg.shadowOpacity,
        SHADOWS.xl.shadowOpacity,
      ];

      opacities.forEach((opacity) => {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("Type Safety", () => {
    it("has correct property types", () => {
      const shadowKeys = ["sm", "md", "lg", "xl"] as const;

      shadowKeys.forEach((key) => {
        const shadow = SHADOWS[key];
        expect(typeof shadow.shadowColor).toBe("string");
        expect(typeof shadow.shadowOffset).toBe("object");
        expect(typeof shadow.shadowOffset.width).toBe("number");
        expect(typeof shadow.shadowOffset.height).toBe("number");
        expect(typeof shadow.shadowOpacity).toBe("number");
        expect(typeof shadow.shadowRadius).toBe("number");
        expect(typeof shadow.elevation).toBe("number");
      });
    });
  });
});
