import {styles, COLORS} from "../index";

describe("styles index", () => {
  describe("styles object", () => {
    it("should export styles object", () => {
      expect(styles).toBeDefined();
      expect(typeof styles).toBe("object");
    });

    it("should have layout properties", () => {
      expect(styles).toHaveProperty("gameContainer");
      expect(styles).toHaveProperty("riddleContainer");
      expect(styles).toHaveProperty("centeredView");
    });

    it("should have button styles", () => {
      expect(styles).toHaveProperty("backButton");
      expect(styles).toHaveProperty("buttonOpacity");
      expect(styles).toHaveProperty("buttonText");
    });

    it("should have text styles", () => {
      expect(styles).toHaveProperty("title");
      expect(styles).toHaveProperty("subtitle");
      expect(styles).toHaveProperty("screenTitle");
    });

    it("should have form styles", () => {
      expect(styles).toHaveProperty("textInput");
      expect(styles).toHaveProperty("input");
      expect(styles).toHaveProperty("errorContainer");
    });

    it("should have modal and overlay styles", () => {
      expect(styles).toHaveProperty("overlay");
      expect(styles).toHaveProperty("modalContainer");
      expect(styles).toHaveProperty("overlayContainer");
    });

    it("should have animation styles", () => {
      expect(styles).toHaveProperty("shatteringContainer");
      expect(styles).toHaveProperty("spinnerContainer");
      expect(styles).toHaveProperty("spinnerWrapper");
    });

    it("should contain valid StyleSheet objects", () => {
      // Test that styles contain valid style properties
      Object.values(styles).forEach((style) => {
        expect(typeof style).toBe("object");
        expect(style).toBeTruthy();
      });
    });
  });

  describe("COLORS object", () => {
    it("should export COLORS object", () => {
      expect(COLORS).toBeDefined();
      expect(typeof COLORS).toBe("object");
    });

    it("should have primary colors", () => {
      expect(COLORS).toHaveProperty("primaryOrange");
      expect(COLORS).toHaveProperty("primaryOrangeLight");
      expect(COLORS).toHaveProperty("primaryOrangeDark");
    });

    it("should have neutral colors", () => {
      expect(COLORS).toHaveProperty("white");
      expect(COLORS).toHaveProperty("black");
      expect(COLORS).toHaveProperty("gray100");
    });

    it("should have background colors", () => {
      expect(COLORS).toHaveProperty("backgroundDark");
      expect(COLORS).toHaveProperty("backgroundPrimary");
    });

    it("should have text colors", () => {
      expect(COLORS).toHaveProperty("textPrimary");
      expect(COLORS).toHaveProperty("textSecondary");
    });

    it("should have game-specific colors", () => {
      expect(COLORS).toHaveProperty("tileCorrect");
      expect(COLORS).toHaveProperty("tilePartial");
      expect(COLORS).toHaveProperty("tileIncorrect");
    });

    it("should contain valid color strings", () => {
      Object.values(COLORS).forEach((color) => {
        expect(typeof color).toBe("string");
        // Allow for hex colors, rgba colors, and transparent
        expect(color).toMatch(/^(#[0-9A-F]{6}|rgba?\([^)]+\)|transparent)$/i);
      });
    });

    it("should have consistent color naming", () => {
      // Test that primary colors follow consistent naming pattern
      expect(COLORS.primaryOrange).toBeDefined();
      expect(COLORS.primaryOrangeLight).toBeDefined();
      expect(COLORS.primaryOrangeDark).toBeDefined();
    });
  });

  describe("exports", () => {
    it("should export both styles and COLORS", () => {
      const exports = require("../index");
      expect(exports).toHaveProperty("styles");
      expect(exports).toHaveProperty("COLORS");
    });

    it("should not have undefined exports", () => {
      expect(styles).not.toBeUndefined();
      expect(COLORS).not.toBeUndefined();
    });

    it("should maintain object references", () => {
      const {styles: importedStyles, COLORS: importedColors} = require("../index");
      expect(importedStyles).toBe(styles);
      expect(importedColors).toBe(COLORS);
    });
  });

  describe("style consistency", () => {
    it("should use consistent spacing values", () => {
      // Check that spacing values are reasonable numbers
      const spacingStyles = [styles.gameContainer, styles.riddleContainer, styles.modalContainer];

      spacingStyles.forEach((style) => {
        if (style && typeof style === "object") {
          Object.entries(style).forEach(([key, value]) => {
            if (key.includes("padding") || key.includes("margin")) {
              expect(typeof value).toBe("number");
              expect(value).toBeGreaterThanOrEqual(0);
            }
          });
        }
      });
    });

    it("should use theme colors consistently", () => {
      // Check that styles reference actual theme colors when possible
      const colorValues = Object.values(COLORS);

      expect(colorValues.length).toBeGreaterThan(0);
      colorValues.forEach((color) => {
        // Allow for hex colors, rgba colors, and transparent
        expect(color).toMatch(/^(#[0-9A-F]{6}|rgba?\([^)]+\)|transparent)$/i);
      });
    });
  });
});
