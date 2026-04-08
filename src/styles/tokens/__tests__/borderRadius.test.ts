import { BORDER_RADIUS } from "../borderRadius";

describe("BORDER_RADIUS", () => {
  describe("Structure", () => {
    it("exports BORDER_RADIUS object", () => {
      expect(BORDER_RADIUS).toBeDefined();
      expect(typeof BORDER_RADIUS).toBe("object");
    });

    it("contains all required border radius sizes", () => {
      expect(BORDER_RADIUS.none).toBeDefined();
      expect(BORDER_RADIUS.sm).toBeDefined();
      expect(BORDER_RADIUS.md).toBeDefined();
      expect(BORDER_RADIUS.lg).toBeDefined();
      expect(BORDER_RADIUS.xl).toBeDefined();
      expect(BORDER_RADIUS.full).toBeDefined();
    });
  });

  describe("Values", () => {
    it("has correct none value", () => {
      expect(BORDER_RADIUS.none).toBe(0);
    });

    it("has positive values for responsive sizes", () => {
      expect(BORDER_RADIUS.sm).toBeGreaterThan(0);
      expect(BORDER_RADIUS.md).toBeGreaterThan(0);
      expect(BORDER_RADIUS.lg).toBeGreaterThan(0);
      expect(BORDER_RADIUS.xl).toBeGreaterThan(0);
      expect(BORDER_RADIUS.full).toBeGreaterThan(0);
    });

    it("has progressive sizing", () => {
      expect(BORDER_RADIUS.sm).toBeGreaterThan(BORDER_RADIUS.none);
      expect(BORDER_RADIUS.md).toBeGreaterThan(BORDER_RADIUS.sm);
      expect(BORDER_RADIUS.lg).toBeGreaterThan(BORDER_RADIUS.md);
      expect(BORDER_RADIUS.xl).toBeGreaterThan(BORDER_RADIUS.lg);
    });
  });

  describe("Type Safety", () => {
    it("has correct types for all values", () => {
      expect(typeof BORDER_RADIUS.none).toBe("number");
      expect(typeof BORDER_RADIUS.sm).toBe("number");
      expect(typeof BORDER_RADIUS.md).toBe("number");
      expect(typeof BORDER_RADIUS.lg).toBe("number");
      expect(typeof BORDER_RADIUS.xl).toBe("number");
      expect(typeof BORDER_RADIUS.full).toBe("number");
    });

    it("all values are finite numbers", () => {
      const values = Object.values(BORDER_RADIUS);
      values.forEach((value) => {
        expect(Number.isFinite(value)).toBe(true);
      });
    });
  });

  describe("Specific Values", () => {
    it("none is exactly zero", () => {
      expect(BORDER_RADIUS.none).toEqual(0);
    });

    it("full is the largest value", () => {
      const values = [
        BORDER_RADIUS.none,
        BORDER_RADIUS.sm,
        BORDER_RADIUS.md,
        BORDER_RADIUS.lg,
        BORDER_RADIUS.xl,
        BORDER_RADIUS.full,
      ];

      expect(BORDER_RADIUS.full).toBe(Math.max(...values));
    });

    it("maintains consistent scaling", () => {
      // Test that each size is appropriately larger than the previous
      expect(BORDER_RADIUS.sm).toBeGreaterThan(BORDER_RADIUS.none);
      expect(BORDER_RADIUS.md).toBeGreaterThan(BORDER_RADIUS.sm);
      expect(BORDER_RADIUS.lg).toBeGreaterThan(BORDER_RADIUS.md);
      expect(BORDER_RADIUS.xl).toBeGreaterThan(BORDER_RADIUS.lg);
    });
  });

  describe("Responsive Integration", () => {
    it("uses responsive utilities for sizing", () => {
      // Since these come from responsive utilities, they should be reasonable sizes
      expect(BORDER_RADIUS.sm).toBeGreaterThan(1);
      expect(BORDER_RADIUS.sm).toBeLessThan(20);

      expect(BORDER_RADIUS.md).toBeGreaterThan(BORDER_RADIUS.sm);
      expect(BORDER_RADIUS.md).toBeLessThan(50);

      expect(BORDER_RADIUS.lg).toBeGreaterThan(BORDER_RADIUS.md);
      expect(BORDER_RADIUS.lg).toBeLessThan(100);
    });
  });

  describe("Usability", () => {
    it("can be used as style values", () => {
      // These should be valid for React Native border radius
      const testStyle = {
        borderRadius: BORDER_RADIUS.md,
        borderTopLeftRadius: BORDER_RADIUS.sm,
        borderTopRightRadius: BORDER_RADIUS.lg,
        borderBottomLeftRadius: BORDER_RADIUS.xl,
        borderBottomRightRadius: BORDER_RADIUS.full,
      };

      expect(testStyle.borderRadius).toBe(BORDER_RADIUS.md);
      expect(testStyle.borderTopLeftRadius).toBe(BORDER_RADIUS.sm);
      expect(testStyle.borderTopRightRadius).toBe(BORDER_RADIUS.lg);
      expect(testStyle.borderBottomLeftRadius).toBe(BORDER_RADIUS.xl);
      expect(testStyle.borderBottomRightRadius).toBe(BORDER_RADIUS.full);
    });

    it("provides good default options", () => {
      // Should have a good range of options
      const keys = Object.keys(BORDER_RADIUS);
      expect(keys).toContain("none");
      expect(keys).toContain("sm");
      expect(keys).toContain("md");
      expect(keys).toContain("lg");
      expect(keys).toContain("xl");
      expect(keys).toContain("full");
      expect(keys).toContain("2xl");
      expect(keys.length).toBe(7);
    });
  });
});
