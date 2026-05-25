import {createButtonStyle} from "../createButtonStyle";
import {COLORS} from "../../tokens/colors";
import {TYPOGRAPHY} from "../../tokens/typography";
import {SPACING} from "../../tokens/spacing";
import {BORDER_RADIUS} from "../../tokens/borderRadius";
import {SIZING} from "../../tokens/sizing";
import {SHADOWS} from "../../tokens/shadows";

describe("createButtonStyle", () => {
  describe("default behavior", () => {
    it("should create solid button style with default parameters", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button).toMatchObject({
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        minHeight: SIZING.button.height,
        backgroundColor: COLORS.primaryOrange,
        ...SHADOWS.sm,
      });

      expect(buttonStyle.text).toMatchObject({
        fontFamily: TYPOGRAPHY.fontPrimary,
        fontSize: TYPOGRAPHY.fontSize.base,
        fontWeight: "400",
        color: COLORS.white,
      });
    });

    it("should have both button and text properties", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle).toHaveProperty("button");
      expect(buttonStyle).toHaveProperty("text");
      expect(typeof buttonStyle.button).toBe("object");
      expect(typeof buttonStyle.text).toBe("object");
    });
  });

  describe("solid variant (default)", () => {
    it("should create solid button with custom colors", () => {
      const backgroundColor = "#ff0000";
      const textColor = "#ffffff";
      const buttonStyle = createButtonStyle(backgroundColor, textColor, "solid");

      expect(buttonStyle.button.backgroundColor).toBe(backgroundColor);
      expect(buttonStyle.text.color).toBe(textColor);
      expect(buttonStyle.button).toMatchObject(SHADOWS.sm);
    });

    it("should include shadow for solid buttons", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button).toMatchObject(SHADOWS.sm);
    });

    it("should not have border properties for solid buttons", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button.borderWidth).toBeUndefined();
      expect(buttonStyle.button.borderColor).toBeUndefined();
    });
  });

  describe("outline variant", () => {
    it("should create outline button with default colors", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "outline");

      expect(buttonStyle.button).toMatchObject({
        backgroundColor: COLORS.transparent,
        borderWidth: 2,
        borderColor: COLORS.primaryOrange,
      });

      expect(buttonStyle.text.color).toBe(COLORS.primaryOrange);
    });

    it("should create outline button with custom colors", () => {
      const customColor = "#00ff00";
      const buttonStyle = createButtonStyle(customColor, undefined, "outline");

      expect(buttonStyle.button).toMatchObject({
        backgroundColor: COLORS.transparent,
        borderWidth: 2,
        borderColor: customColor,
      });

      expect(buttonStyle.text.color).toBe(customColor);
    });

    it("should not have shadow for outline buttons", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "outline");

      // Check that shadow properties are not present
      expect(buttonStyle.button.shadowColor).toBeUndefined();
      expect(buttonStyle.button.shadowOffset).toBeUndefined();
      expect(buttonStyle.button.shadowOpacity).toBeUndefined();
      expect(buttonStyle.button.shadowRadius).toBeUndefined();
      expect(buttonStyle.button.elevation).toBeUndefined();
    });

    it("should have correct base structure for outline buttons", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "outline");

      expect(buttonStyle.button).toMatchObject({
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        minHeight: SIZING.button.height,
      });
    });
  });

  describe("ghost variant", () => {
    it("should create ghost button with default colors", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "ghost");

      expect(buttonStyle.button).toMatchObject({
        backgroundColor: COLORS.transparent,
      });

      expect(buttonStyle.text.color).toBe(COLORS.primaryOrange);
    });

    it("should create ghost button with custom colors", () => {
      const customColor = "#0000ff";
      const buttonStyle = createButtonStyle(customColor, undefined, "ghost");

      expect(buttonStyle.button.backgroundColor).toBe(COLORS.transparent);
      expect(buttonStyle.text.color).toBe(customColor);
    });

    it("should not have border properties for ghost buttons", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "ghost");

      expect(buttonStyle.button.borderWidth).toBeUndefined();
      expect(buttonStyle.button.borderColor).toBeUndefined();
    });

    it("should not have shadow for ghost buttons", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "ghost");

      // Check that shadow properties are not present
      expect(buttonStyle.button.shadowColor).toBeUndefined();
      expect(buttonStyle.button.shadowOffset).toBeUndefined();
      expect(buttonStyle.button.shadowOpacity).toBeUndefined();
      expect(buttonStyle.button.shadowRadius).toBeUndefined();
      expect(buttonStyle.button.elevation).toBeUndefined();
    });

    it("should have correct base structure for ghost buttons", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, "ghost");

      expect(buttonStyle.button).toMatchObject({
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        minHeight: SIZING.button.height,
      });
    });
  });

  describe("custom parameters", () => {
    it("should handle custom background color", () => {
      const customBg = "#ff69b4";
      const buttonStyle = createButtonStyle(customBg);

      expect(buttonStyle.button.backgroundColor).toBe(customBg);
    });

    it("should handle custom text color", () => {
      const customText = "#000000";
      const buttonStyle = createButtonStyle(undefined, customText);

      expect(buttonStyle.text.color).toBe(customText);
    });

    it("should handle all custom parameters", () => {
      const customBg = "#ff69b4";
      const customText = "#000000";
      const variant = "outline";

      const buttonStyle = createButtonStyle(customBg, customText, variant);

      expect(buttonStyle.button.backgroundColor).toBe(COLORS.transparent);
      expect(buttonStyle.button.borderColor).toBe(customBg);
      expect(buttonStyle.text.color).toBe(customBg);
    });
  });

  describe("base styles consistency", () => {
    it("should have consistent base button styles across all variants", () => {
      const solidStyle = createButtonStyle(undefined, undefined, "solid");
      const outlineStyle = createButtonStyle(undefined, undefined, "outline");
      const ghostStyle = createButtonStyle(undefined, undefined, "ghost");

      // Check specific properties instead of dynamic indexing
      expect(solidStyle.button.alignItems).toBe(outlineStyle.button.alignItems);
      expect(solidStyle.button.alignItems).toBe(ghostStyle.button.alignItems);

      expect(solidStyle.button.justifyContent).toBe(outlineStyle.button.justifyContent);
      expect(solidStyle.button.justifyContent).toBe(ghostStyle.button.justifyContent);

      expect(solidStyle.button.paddingHorizontal).toBe(outlineStyle.button.paddingHorizontal);
      expect(solidStyle.button.paddingHorizontal).toBe(ghostStyle.button.paddingHorizontal);

      expect(solidStyle.button.paddingVertical).toBe(outlineStyle.button.paddingVertical);
      expect(solidStyle.button.paddingVertical).toBe(ghostStyle.button.paddingVertical);

      expect(solidStyle.button.borderRadius).toBe(outlineStyle.button.borderRadius);
      expect(solidStyle.button.borderRadius).toBe(ghostStyle.button.borderRadius);

      expect(solidStyle.button.minHeight).toBe(outlineStyle.button.minHeight);
      expect(solidStyle.button.minHeight).toBe(ghostStyle.button.minHeight);
    });

    it("should have consistent base text styles across all variants", () => {
      const solidStyle = createButtonStyle(undefined, undefined, "solid");
      const outlineStyle = createButtonStyle(undefined, undefined, "outline");
      const ghostStyle = createButtonStyle(undefined, undefined, "ghost");

      // Check specific properties instead of dynamic indexing
      expect(solidStyle.text.fontFamily).toBe(outlineStyle.text.fontFamily);
      expect(solidStyle.text.fontFamily).toBe(ghostStyle.text.fontFamily);

      expect(solidStyle.text.fontSize).toBe(outlineStyle.text.fontSize);
      expect(solidStyle.text.fontSize).toBe(ghostStyle.text.fontSize);

      expect(solidStyle.text.fontWeight).toBe(outlineStyle.text.fontWeight);
      expect(solidStyle.text.fontWeight).toBe(ghostStyle.text.fontWeight);
    });
  });

  describe("color formats", () => {
    it("should work with hex colors", () => {
      const hexColor = "#FF5733";
      const buttonStyle = createButtonStyle(hexColor);

      expect(buttonStyle.button.backgroundColor).toBe(hexColor);
    });

    it("should work with rgba colors", () => {
      const rgbaColor = "rgba(255, 87, 51, 0.8)";
      const buttonStyle = createButtonStyle(rgbaColor);

      expect(buttonStyle.button.backgroundColor).toBe(rgbaColor);
    });

    it("should work with named colors", () => {
      const namedColor = "blue";
      const buttonStyle = createButtonStyle(namedColor);

      expect(buttonStyle.button.backgroundColor).toBe(namedColor);
    });
  });

  describe("variant parameter validation", () => {
    it("should default to solid for invalid variant", () => {
      // @ts-expect-error Testing invalid variant
      const buttonStyle = createButtonStyle(undefined, undefined, "invalid");

      expect(buttonStyle.button.backgroundColor).toBe(COLORS.primaryOrange);
      expect(buttonStyle.button).toMatchObject(SHADOWS.sm);
    });

    it("should handle undefined variant", () => {
      const buttonStyle = createButtonStyle(undefined, undefined, undefined);

      expect(buttonStyle.button.backgroundColor).toBe(COLORS.primaryOrange);
      expect(buttonStyle.button).toMatchObject(SHADOWS.sm);
    });
  });

  describe("return type validation", () => {
    it("should return object with correct structure", () => {
      const buttonStyle = createButtonStyle();

      expect(typeof buttonStyle).toBe("object");
      expect(typeof buttonStyle.button).toBe("object");
      expect(typeof buttonStyle.text).toBe("object");
    });

    it("should not modify token imports", () => {
      const originalSpacing = {...SPACING};
      const originalColors = {...COLORS};

      createButtonStyle();

      expect(SPACING).toEqual(originalSpacing);
      expect(COLORS).toEqual(originalColors);
    });
  });

  describe("accessibility and usability", () => {
    it("should have minimum touch target size", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button.minHeight).toBe(SIZING.button.height);
      expect(typeof buttonStyle.button.minHeight).toBe("number");
    });

    it("should have appropriate padding for touch targets", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button.paddingHorizontal).toBe(SPACING.lg);
      expect(buttonStyle.button.paddingVertical).toBe(SPACING.md);
    });

    it("should center content for accessibility", () => {
      const buttonStyle = createButtonStyle();

      expect(buttonStyle.button.alignItems).toBe("center");
      expect(buttonStyle.button.justifyContent).toBe("center");
    });
  });
});
