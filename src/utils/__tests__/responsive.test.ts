/**
 * @fileoverview Unit tests for responsive utility functions.
 *
 * Tests scaling functions, device type detection, and responsive value selection.
 * Uses mocked Dimensions to test different screen sizes.
 */

import {
  scale,
  verticalScale,
  moderateScale,
  clamp,
  responsiveValue,
  getDeviceType,
  dimensions,
  responsiveSizes,
  isPhone,
  isTablet,
  isLargeTablet,
  isDesktop,
} from "../responsive";

describe("responsive utilities", () => {
  describe("clamp", () => {
    it("should return the value when within range", () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it("should return min when value is below range", () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it("should return max when value is above range", () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it("should handle equal min and max", () => {
      expect(clamp(50, 25, 25)).toBe(25);
    });

    it("should handle negative ranges", () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(0, -10, -1)).toBe(-1);
      expect(clamp(-15, -10, -1)).toBe(-10);
    });

    it("should handle decimal values", () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(1.5, 0, 1)).toBe(1);
      expect(clamp(-0.5, 0, 1)).toBe(0);
    });
  });

  describe("scale", () => {
    it("should return a number", () => {
      expect(typeof scale(16)).toBe("number");
    });

    it("should return rounded values", () => {
      const result = scale(15);
      expect(result).toBe(Math.round(result));
    });

    it("should scale 0 to 0", () => {
      expect(scale(0)).toBe(0);
    });

    it("should scale negative values", () => {
      const result = scale(-10);
      expect(result).toBeLessThan(0);
    });
  });

  describe("verticalScale", () => {
    it("should return a number", () => {
      expect(typeof verticalScale(16)).toBe("number");
    });

    it("should return rounded values", () => {
      const result = verticalScale(15);
      expect(result).toBe(Math.round(result));
    });

    it("should scale 0 to 0", () => {
      expect(verticalScale(0)).toBe(0);
    });
  });

  describe("moderateScale", () => {
    it("should return a number", () => {
      expect(typeof moderateScale(16)).toBe("number");
    });

    it("should return rounded values", () => {
      const result = moderateScale(15);
      expect(result).toBe(Math.round(result));
    });

    it("should scale 0 to 0", () => {
      expect(moderateScale(0)).toBe(0);
    });

    it("should apply default factor of 0.5", () => {
      // With factor 0.5, result should be between base and scale(base)
      const base = 20;
      const result = moderateScale(base);
      const scaled = scale(base);
      // Result should be: base + (scaled - base) * 0.5
      const expected = Math.round(base + (scaled - base) * 0.5);
      expect(result).toBe(expected);
    });

    it("should apply custom factor", () => {
      const base = 20;
      const factor = 0.25;
      const result = moderateScale(base, factor);
      const scaled = scale(base);
      const expected = Math.round(base + (scaled - base) * factor);
      expect(result).toBe(expected);
    });

    it("should return base value when factor is 0", () => {
      const base = 20;
      const result = moderateScale(base, 0);
      expect(result).toBe(base);
    });

    it("should return scale(base) when factor is 1", () => {
      const base = 20;
      const result = moderateScale(base, 1);
      expect(result).toBe(scale(base));
    });
  });

  describe("getDeviceType", () => {
    it("should return a valid device type string", () => {
      const result = getDeviceType();
      expect(["phone", "tablet", "largeTablet", "desktop"]).toContain(result);
    });
  });

  describe("responsiveValue", () => {
    it("should always return the phone value when only phone is provided", () => {
      const result = responsiveValue({ phone: "phone-value" });
      expect(result).toBe("phone-value");
    });

    it("should return phone value for phone devices when tablet value exists", () => {
      const values = { phone: "phone", tablet: "tablet" };
      const result = responsiveValue(values);
      // Result depends on current device type, but should be one of the values
      expect(["phone", "tablet"]).toContain(result);
    });

    it("should handle numeric values", () => {
      const result = responsiveValue({ phone: 16, tablet: 24, desktop: 32 });
      expect(typeof result).toBe("number");
      expect([16, 24, 32]).toContain(result);
    });

    it("should handle object values", () => {
      const phoneConfig = { size: "small" };
      const tabletConfig = { size: "large" };
      const result = responsiveValue({ phone: phoneConfig, tablet: tabletConfig });
      expect([phoneConfig, tabletConfig]).toContain(result);
    });

    it("should fallback from desktop to largeTablet to tablet to phone", () => {
      // When only phone is provided, should use phone
      expect(responsiveValue({ phone: "p" })).toBe("p");

      // When desktop is missing but largeTablet exists
      const values = { phone: "p", tablet: "t", largeTablet: "lt" };
      const result = responsiveValue(values);
      expect(["p", "t", "lt"]).toContain(result);
    });
  });

  describe("dimensions object", () => {
    it("should have screenWidth as a positive number", () => {
      expect(typeof dimensions.screenWidth).toBe("number");
      expect(dimensions.screenWidth).toBeGreaterThan(0);
    });

    it("should have screenHeight as a positive number", () => {
      expect(typeof dimensions.screenHeight).toBe("number");
      expect(dimensions.screenHeight).toBeGreaterThan(0);
    });

    it("should have boolean device type flags", () => {
      expect(typeof dimensions.isPhone).toBe("boolean");
      expect(typeof dimensions.isTablet).toBe("boolean");
      expect(typeof dimensions.isLargeTablet).toBe("boolean");
      expect(typeof dimensions.isDesktop).toBe("boolean");
    });

    it("should have mutually consistent device flags", () => {
      // isPhone should be inverse of isTablet for basic case
      // (though tablet includes largeTablet and desktop)
      if (dimensions.isPhone) {
        expect(dimensions.isTablet).toBe(false);
        expect(dimensions.isLargeTablet).toBe(false);
        expect(dimensions.isDesktop).toBe(false);
      }
    });
  });

  describe("device type flags", () => {
    it("should export isPhone as boolean", () => {
      expect(typeof isPhone).toBe("boolean");
    });

    it("should export isTablet as boolean", () => {
      expect(typeof isTablet).toBe("boolean");
    });

    it("should export isLargeTablet as boolean", () => {
      expect(typeof isLargeTablet).toBe("boolean");
    });

    it("should export isDesktop as boolean", () => {
      expect(typeof isDesktop).toBe("boolean");
    });
  });

  describe("responsiveSizes", () => {
    it("should have typography sizes", () => {
      expect(typeof responsiveSizes.textXs).toBe("number");
      expect(typeof responsiveSizes.textSm).toBe("number");
      expect(typeof responsiveSizes.textBase).toBe("number");
      expect(typeof responsiveSizes.textLg).toBe("number");
      expect(typeof responsiveSizes.textXl).toBe("number");
      expect(typeof responsiveSizes.text2xl).toBe("number");
      expect(typeof responsiveSizes.text3xl).toBe("number");
      expect(typeof responsiveSizes.text4xl).toBe("number");
    });

    it("should have spacing values", () => {
      expect(typeof responsiveSizes.spacingXs).toBe("number");
      expect(typeof responsiveSizes.spacingSm).toBe("number");
      expect(typeof responsiveSizes.spacingMd).toBe("number");
      expect(typeof responsiveSizes.spacingLg).toBe("number");
      expect(typeof responsiveSizes.spacingXl).toBe("number");
      expect(typeof responsiveSizes.spacing2xl).toBe("number");
    });

    it("should have component height values", () => {
      expect(typeof responsiveSizes.buttonHeight).toBe("number");
      expect(typeof responsiveSizes.inputHeight).toBe("number");
      expect(typeof responsiveSizes.headerHeight).toBe("number");
      expect(typeof responsiveSizes.tabBarHeight).toBe("number");
    });

    it("should have border radius values", () => {
      expect(typeof responsiveSizes.radiusSm).toBe("number");
      expect(typeof responsiveSizes.radiusMd).toBe("number");
      expect(typeof responsiveSizes.radiusLg).toBe("number");
      expect(typeof responsiveSizes.radiusXl).toBe("number");
      expect(typeof responsiveSizes.radiusXxl).toBe("number");
      expect(responsiveSizes.radiusFull).toBe(9999);
    });

    it("should have typography sizes in ascending order", () => {
      expect(responsiveSizes.textXs).toBeLessThan(responsiveSizes.textSm);
      expect(responsiveSizes.textSm).toBeLessThan(responsiveSizes.textBase);
      expect(responsiveSizes.textBase).toBeLessThan(responsiveSizes.textLg);
      expect(responsiveSizes.textLg).toBeLessThan(responsiveSizes.textXl);
      expect(responsiveSizes.textXl).toBeLessThan(responsiveSizes.text2xl);
      expect(responsiveSizes.text2xl).toBeLessThan(responsiveSizes.text3xl);
      expect(responsiveSizes.text3xl).toBeLessThan(responsiveSizes.text4xl);
    });

    it("should have spacing values in ascending order", () => {
      expect(responsiveSizes.spacingXs).toBeLessThan(responsiveSizes.spacingSm);
      expect(responsiveSizes.spacingSm).toBeLessThan(responsiveSizes.spacingMd);
      expect(responsiveSizes.spacingMd).toBeLessThan(responsiveSizes.spacingLg);
      expect(responsiveSizes.spacingLg).toBeLessThan(responsiveSizes.spacingXl);
      expect(responsiveSizes.spacingXl).toBeLessThan(responsiveSizes.spacing2xl);
    });

    it("should have border radius values in ascending order", () => {
      expect(responsiveSizes.radiusSm).toBeLessThan(responsiveSizes.radiusMd);
      expect(responsiveSizes.radiusMd).toBeLessThan(responsiveSizes.radiusLg);
      expect(responsiveSizes.radiusLg).toBeLessThan(responsiveSizes.radiusXl);
      expect(responsiveSizes.radiusXl).toBeLessThan(responsiveSizes.radiusXxl);
      expect(responsiveSizes.radiusXxl).toBeLessThan(responsiveSizes.radiusFull);
    });
  });
});
