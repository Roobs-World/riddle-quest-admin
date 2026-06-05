import React from "react";
import {render} from "@testing-library/react-native";
import RiddleText from "../RiddleText";

// Mock responsive utils
jest.mock("../../../utils/responsive", () => ({
  scale: (value: number) => value,
  moderateScale: (value: number) => value,
  verticalScale: (value: number) => value,
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  responsiveSizes: {
    textXs: 12,
    textSm: 14,
    textBase: 16,
    textLg: 18,
    textXl: 20,
    text2xl: 24,
    text3xl: 30,
    text4xl: 36,
    textTitle: 28,
    textDisplay: 32,
    textTile: 28,
    spacingXs: 4,
    spacingSm: 8,
    spacingMd: 16,
    spacingLg: 24,
    spacingXl: 32,
    spacing2xl: 48,
    buttonHeight: 48,
    inputHeight: 48,
    headerHeight: 60,
    tabBarHeight: 60,
    radiusSm: 4,
    radiusMd: 8,
    radiusLg: 12,
    radiusXl: 16,
    radiusXxl: 20,
    radiusFull: 9999,
  },
}));

// Mock styles (RiddleText uses TYPOGRAPHY.fontPrimary)
jest.mock("../../../styles", () => ({
  COLORS: {
    textShadowDark: "rgba(0, 0, 0, 0.75)",
    primary: "#000000",
    secondary: "#ffffff",
    white: "#ffffff",
  },
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSize: {xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, title: 28, display: 32},
    lineHeight: {tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48},
}));

describe("RiddleText", () => {
  describe("Rendering", () => {
    it("renders the riddle text correctly", () => {
      const riddleText = "What has keys but no locks?";
      const {getByText} = render(<RiddleText riddleText={riddleText} />);

      expect(getByText(riddleText)).toBeTruthy();
    });

    it("renders with correct container structure", () => {
      const riddleText = "Test riddle";
      const {UNSAFE_getByType} = render(<RiddleText riddleText={riddleText} />);

      const View = require("react-native").View;
      const view = UNSAFE_getByType(View);
      expect(view).toBeTruthy();
    });

    it("renders long riddle text", () => {
      const longRiddle =
        "This is a very long riddle that might span multiple lines and test how the component handles text wrapping and layout when the content is significantly longer than usual";
      const {getByText} = render(<RiddleText riddleText={longRiddle} />);

      expect(getByText(longRiddle)).toBeTruthy();
    });

    it("renders short riddle text", () => {
      const shortRiddle = "Short?";
      const {getByText} = render(<RiddleText riddleText={shortRiddle} />);

      expect(getByText(shortRiddle)).toBeTruthy();
    });

    it("renders riddle with special characters", () => {
      const specialRiddle = "What's the @#$% answer?!";
      const {getByText} = render(<RiddleText riddleText={specialRiddle} />);

      expect(getByText(specialRiddle)).toBeTruthy();
    });

    it("renders riddle with numbers", () => {
      const numberRiddle = "I have 4 legs in the morning, 2 at noon, and 3 in the evening. What am I?";
      const {getByText} = render(<RiddleText riddleText={numberRiddle} />);

      expect(getByText(numberRiddle)).toBeTruthy();
    });

    it("renders riddle with emojis", () => {
      const emojiRiddle = "What goes 🚗 but never moves?";
      const {getByText} = render(<RiddleText riddleText={emojiRiddle} />);

      expect(getByText(emojiRiddle)).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("renders empty string riddle", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="" />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe("");
    });

    it("renders riddle with only whitespace", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="   " />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe("   ");
    });

    it("renders riddle with line breaks", () => {
      const multilineRiddle = "Line 1\nLine 2\nLine 3";
      const {getByText} = render(<RiddleText riddleText={multilineRiddle} />);

      expect(getByText(multilineRiddle)).toBeTruthy();
    });

    it("renders riddle with tabs", () => {
      const tabbedRiddle = "Question:\t\tWhat am I?";
      const {getByText} = render(<RiddleText riddleText={tabbedRiddle} />);

      expect(getByText(tabbedRiddle)).toBeTruthy();
    });

    it("handles undefined riddle gracefully", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText={undefined as any} />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements).toBeTruthy();
    });

    it("handles null riddle gracefully", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText={null as any} />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements).toBeTruthy();
    });

    it("handles number as riddle", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText={42 as any} />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe(42);
    });
  });

  describe("Style and Layout", () => {
    it("applies correct text styling", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test riddle" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.className).toContain("text-center");
      expect(textElement.props.className).toContain("text-white");
      const style = Array.isArray(textElement.props.style)
        ? Object.assign({}, ...textElement.props.style)
        : (textElement.props.style ?? {});
      expect(style.fontSize).toBeDefined();
    });

    it("uses correct number of lines", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test riddle" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.numberOfLines).toBe(3);
    });

    it("uses adjustsFontSizeToFit", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test riddle" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.adjustsFontSizeToFit).toBe(true);
      expect(textElement.props.minimumFontScale).toBe(0.8);
    });

    it("applies font and layout styles from StyleSheet", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test riddle" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.style).toMatchObject({
        color: "#ffffff",
        fontSize: 24,
        lineHeight: 36,
        maxWidth: 351,
      });
    });

    it("applies container styling", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test riddle" />);

      const View = require("react-native").View;
      const viewElement = UNSAFE_getAllByType(View)[0];
      expect(viewElement.props.className).toContain("items-center");
      expect(viewElement.props.className).toContain("z-10");
      const style = viewElement.props.style ?? {};
      expect(style.paddingHorizontal).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("renders consistently with prop changes", () => {
      const {rerender, getByText} = render(<RiddleText riddleText="First riddle" />);

      expect(getByText("First riddle")).toBeTruthy();

      rerender(<RiddleText riddleText="Second riddle" />);
      expect(getByText("Second riddle")).toBeTruthy();

      rerender(<RiddleText riddleText="Third riddle" />);
      expect(getByText("Third riddle")).toBeTruthy();
    });

    it("handles rapid prop updates", () => {
      const {rerender} = render(<RiddleText riddleText="Initial" />);

      for (let i = 0; i < 20; i++) {
        rerender(<RiddleText riddleText={`Riddle ${i}`} />);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe("Text Variations", () => {
    it("renders riddles with punctuation", () => {
      const punctuatedRiddle = "What's black, white, and read all over? A newspaper!";
      const {getByText} = render(<RiddleText riddleText={punctuatedRiddle} />);

      expect(getByText(punctuatedRiddle)).toBeTruthy();
    });

    it("renders riddles with quotes", () => {
      const quotedRiddle = 'I am "nothing" and "everything". What am I?';
      const {getByText} = render(<RiddleText riddleText={quotedRiddle} />);

      expect(getByText(quotedRiddle)).toBeTruthy();
    });

    it("renders riddles with mixed case", () => {
      const mixedCaseRiddle = "WhAt GoEs Up BuT nEvEr CoMeS dOwN?";
      const {getByText} = render(<RiddleText riddleText={mixedCaseRiddle} />);

      expect(getByText(mixedCaseRiddle)).toBeTruthy();
    });
  });

  describe("Responsive Scaling", () => {
    it("calls moderateScale for font properties", () => {
      const {UNSAFE_getAllByType} = render(<RiddleText riddleText="Test" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];

      // Since we mocked moderateScale to return the same value,
      // we verify the values match what was passed to moderateScale
      expect(textElement.props.style.fontSize).toBe(24);
      expect(textElement.props.style.lineHeight).toBe(36);
      expect(textElement.props.style.maxWidth).toBe(351);
    });
  });
});
