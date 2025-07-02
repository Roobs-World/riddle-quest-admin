import { createShadow } from "../createShadow";
import { COLORS } from "../../tokens/colors";

describe("createShadow", () => {
  describe("default behavior", () => {
    it("should create a shadow with default parameters", () => {
      const shadow = createShadow();

      expect(shadow).toEqual({
        shadowColor: COLORS.shadowColor,
        shadowOffset: { width: 0, height: 2.5 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      });
    });

    it("should have all required shadow properties", () => {
      const shadow = createShadow();

      expect(shadow).toHaveProperty("shadowColor");
      expect(shadow).toHaveProperty("shadowOffset");
      expect(shadow).toHaveProperty("shadowOpacity");
      expect(shadow).toHaveProperty("shadowRadius");
      expect(shadow).toHaveProperty("elevation");
    });
  });

  describe("custom elevation", () => {
    it("should create shadow with custom elevation", () => {
      const elevation = 10;
      const shadow = createShadow(elevation);

      expect(shadow.elevation).toBe(elevation);
      expect(shadow.shadowOffset.height).toBe(elevation / 2);
      expect(shadow.shadowOffset.width).toBe(0);
    });

    it("should handle zero elevation", () => {
      const shadow = createShadow(0);

      expect(shadow.elevation).toBe(0);
      expect(shadow.shadowOffset.height).toBe(0);
    });

    it("should handle negative elevation", () => {
      const shadow = createShadow(-5);

      expect(shadow.elevation).toBe(-5);
      expect(shadow.shadowOffset.height).toBe(-2.5);
    });

    it("should handle large elevation values", () => {
      const shadow = createShadow(100);

      expect(shadow.elevation).toBe(100);
      expect(shadow.shadowOffset.height).toBe(50);
    });
  });

  describe("custom shadow opacity", () => {
    it("should create shadow with custom opacity", () => {
      const opacity = 0.5;
      const shadow = createShadow(5, opacity);

      expect(shadow.shadowOpacity).toBe(opacity);
    });

    it("should handle zero opacity", () => {
      const shadow = createShadow(5, 0);

      expect(shadow.shadowOpacity).toBe(0);
    });

    it("should handle full opacity", () => {
      const shadow = createShadow(5, 1);

      expect(shadow.shadowOpacity).toBe(1);
    });
  });

  describe("custom shadow radius", () => {
    it("should create shadow with custom radius", () => {
      const radius = 8;
      const shadow = createShadow(5, 0.25, radius);

      expect(shadow.shadowRadius).toBe(radius);
    });

    it("should handle zero radius", () => {
      const shadow = createShadow(5, 0.25, 0);

      expect(shadow.shadowRadius).toBe(0);
    });

    it("should handle large radius values", () => {
      const shadow = createShadow(5, 0.25, 20);

      expect(shadow.shadowRadius).toBe(20);
    });
  });

  describe("custom shadow color", () => {
    it("should create shadow with custom color", () => {
      const customColor = "#ff0000";
      const shadow = createShadow(5, 0.25, 4, customColor);

      expect(shadow.shadowColor).toBe(customColor);
    });

    it("should work with rgba colors", () => {
      const customColor = "rgba(255, 0, 0, 0.5)";
      const shadow = createShadow(5, 0.25, 4, customColor);

      expect(shadow.shadowColor).toBe(customColor);
    });

    it("should work with named colors", () => {
      const customColor = "red";
      const shadow = createShadow(5, 0.25, 4, customColor);

      expect(shadow.shadowColor).toBe(customColor);
    });
  });

  describe("all parameters combined", () => {
    it("should create shadow with all custom parameters", () => {
      const elevation = 8;
      const opacity = 0.3;
      const radius = 6;
      const color = "#333333";

      const shadow = createShadow(elevation, opacity, radius, color);

      expect(shadow).toEqual({
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: opacity,
        shadowRadius: radius,
        elevation: elevation,
      });
    });
  });

  describe("shadow offset calculation", () => {
    it("should always set width to 0", () => {
      const shadow1 = createShadow(2);
      const shadow2 = createShadow(10);
      const shadow3 = createShadow(50);

      expect(shadow1.shadowOffset.width).toBe(0);
      expect(shadow2.shadowOffset.width).toBe(0);
      expect(shadow3.shadowOffset.width).toBe(0);
    });

    it("should calculate height as elevation / 2", () => {
      const testCases = [
        { elevation: 2, expectedHeight: 1 },
        { elevation: 4, expectedHeight: 2 },
        { elevation: 10, expectedHeight: 5 },
        { elevation: 15, expectedHeight: 7.5 },
      ];

      testCases.forEach(({ elevation, expectedHeight }) => {
        const shadow = createShadow(elevation);
        expect(shadow.shadowOffset.height).toBe(expectedHeight);
      });
    });
  });

  describe("return type validation", () => {
    it("should return an object with the correct structure", () => {
      const shadow = createShadow();

      expect(typeof shadow).toBe("object");
      expect(typeof shadow.shadowColor).toBe("string");
      expect(typeof shadow.shadowOffset).toBe("object");
      expect(typeof shadow.shadowOffset.width).toBe("number");
      expect(typeof shadow.shadowOffset.height).toBe("number");
      expect(typeof shadow.shadowOpacity).toBe("number");
      expect(typeof shadow.shadowRadius).toBe("number");
      expect(typeof shadow.elevation).toBe("number");
    });

    it("should be immutable - not modify input parameters", () => {
      const originalElevation = 5;
      const originalOpacity = 0.25;
      const originalRadius = 4;
      const originalColor = "#000000";

      createShadow(
        originalElevation,
        originalOpacity,
        originalRadius,
        originalColor
      );

      // Parameters should remain unchanged
      expect(originalElevation).toBe(5);
      expect(originalOpacity).toBe(0.25);
      expect(originalRadius).toBe(4);
      expect(originalColor).toBe("#000000");
    });
  });
});
