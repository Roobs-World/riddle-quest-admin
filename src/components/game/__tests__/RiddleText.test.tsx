import React from "react";
import { render } from "@testing-library/react-native";
import RiddleText from "../RiddleText";

// Mock moderateScale from responsive utils
jest.mock("../../../utils/responsive", () => ({
  moderateScale: (value: number) => value,
}));

// Mock COLORS from styles
jest.mock("../../../styles", () => ({
  COLORS: {
    textShadowDark: "rgba(0, 0, 0, 0.75)",
    primary: "#000000",
    secondary: "#ffffff",
  },
}));

describe("RiddleText", () => {
  describe("Rendering", () => {
    it("renders the riddle text correctly", () => {
      const riddleText = "What has keys but no locks?";
      const { getByText } = render(<RiddleText riddleText={riddleText} />);

      expect(getByText(riddleText)).toBeTruthy();
    });

    it("renders with correct container structure", () => {
      const riddleText = "Test riddle";
      const { UNSAFE_getByType } = render(
        <RiddleText riddleText={riddleText} />
      );

      const View = require("react-native").View;
      const view = UNSAFE_getByType(View);
      expect(view).toBeTruthy();
    });

    it("renders long riddle text", () => {
      const longRiddle =
        "This is a very long riddle that might span multiple lines and test how the component handles text wrapping and layout when the content is significantly longer than usual";
      const { getByText } = render(<RiddleText riddleText={longRiddle} />);

      expect(getByText(longRiddle)).toBeTruthy();
    });

    it("renders short riddle text", () => {
      const shortRiddle = "Short?";
      const { getByText } = render(<RiddleText riddleText={shortRiddle} />);

      expect(getByText(shortRiddle)).toBeTruthy();
    });

    it("renders riddle with special characters", () => {
      const specialRiddle = "What's the @#$% answer?!";
      const { getByText } = render(<RiddleText riddleText={specialRiddle} />);

      expect(getByText(specialRiddle)).toBeTruthy();
    });

    it("renders riddle with numbers", () => {
      const numberRiddle =
        "I have 4 legs in the morning, 2 at noon, and 3 in the evening. What am I?";
      const { getByText } = render(<RiddleText riddleText={numberRiddle} />);

      expect(getByText(numberRiddle)).toBeTruthy();
    });

    it("renders riddle with emojis", () => {
      const emojiRiddle = "What goes 🚗 but never moves?";
      const { getByText } = render(<RiddleText riddleText={emojiRiddle} />);

      expect(getByText(emojiRiddle)).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("renders empty string riddle", () => {
      const { UNSAFE_getAllByType } = render(<RiddleText riddleText="" />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe("");
    });

    it("renders riddle with only whitespace", () => {
      const { UNSAFE_getAllByType } = render(<RiddleText riddleText="   " />);

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe("   ");
    });

    it("renders riddle with line breaks", () => {
      const multilineRiddle = "Line 1\nLine 2\nLine 3";
      const { getByText } = render(<RiddleText riddleText={multilineRiddle} />);

      expect(getByText(multilineRiddle)).toBeTruthy();
    });

    it("renders riddle with tabs", () => {
      const tabbedRiddle = "Question:\t\tWhat am I?";
      const { getByText } = render(<RiddleText riddleText={tabbedRiddle} />);

      expect(getByText(tabbedRiddle)).toBeTruthy();
    });

    it("handles undefined riddle gracefully", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText={undefined as any} />
      );

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements).toBeTruthy();
    });

    it("handles null riddle gracefully", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText={null as any} />
      );

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements).toBeTruthy();
    });

    it("handles number as riddle", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText={42 as any} />
      );

      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);
      expect(textElements[0].props.children).toBe(42);
    });
  });

  describe("Style and Layout", () => {
    it("applies correct text styling", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText="Test riddle" />
      );

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.className).toContain("text-center");
      expect(textElement.props.className).toContain("text-white");
      expect(textElement.props.className).toContain("font-bold");
    });

    it("uses correct number of lines", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText="Test riddle" />
      );

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.numberOfLines).toBe(3);
    });

    it("uses adjustsFontSizeToFit", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText="Test riddle" />
      );

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.adjustsFontSizeToFit).toBe(true);
      expect(textElement.props.minimumFontScale).toBe(0.8);
    });

    it("applies text shadow styles", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText="Test riddle" />
      );

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];
      expect(textElement.props.style).toMatchObject({
        fontSize: 24,
        lineHeight: 32,
        textShadowColor: "rgba(0, 0, 0, 0.75)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
        maxWidth: 300,
      });
    });

    it("applies container styling", () => {
      const { UNSAFE_getAllByType } = render(
        <RiddleText riddleText="Test riddle" />
      );

      const View = require("react-native").View;
      const viewElement = UNSAFE_getAllByType(View)[0];
      expect(viewElement.props.className).toContain("px-6");
      expect(viewElement.props.className).toContain("py-4");
      expect(viewElement.props.className).toContain("mb-2");
      expect(viewElement.props.className).toContain("items-center");
      expect(viewElement.props.className).toContain("z-10");
    });
  });

  describe("Performance", () => {
    it("renders consistently with prop changes", () => {
      const { rerender, getByText } = render(
        <RiddleText riddleText="First riddle" />
      );

      expect(getByText("First riddle")).toBeTruthy();

      rerender(<RiddleText riddleText="Second riddle" />);
      expect(getByText("Second riddle")).toBeTruthy();

      rerender(<RiddleText riddleText="Third riddle" />);
      expect(getByText("Third riddle")).toBeTruthy();
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(<RiddleText riddleText="Initial" />);

      for (let i = 0; i < 20; i++) {
        rerender(<RiddleText riddleText={`Riddle ${i}`} />);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe("Text Variations", () => {
    it("renders riddles with punctuation", () => {
      const punctuatedRiddle =
        "What's black, white, and read all over? A newspaper!";
      const { getByText } = render(
        <RiddleText riddleText={punctuatedRiddle} />
      );

      expect(getByText(punctuatedRiddle)).toBeTruthy();
    });

    it("renders riddles with quotes", () => {
      const quotedRiddle = 'I am "nothing" and "everything". What am I?';
      const { getByText } = render(<RiddleText riddleText={quotedRiddle} />);

      expect(getByText(quotedRiddle)).toBeTruthy();
    });

    it("renders riddles with mixed case", () => {
      const mixedCaseRiddle = "WhAt GoEs Up BuT nEvEr CoMeS dOwN?";
      const { getByText } = render(<RiddleText riddleText={mixedCaseRiddle} />);

      expect(getByText(mixedCaseRiddle)).toBeTruthy();
    });
  });

  describe("Responsive Scaling", () => {
    it("calls moderateScale for font properties", () => {
      const { UNSAFE_getAllByType } = render(<RiddleText riddleText="Test" />);

      const Text = require("react-native").Text;
      const textElement = UNSAFE_getAllByType(Text)[0];

      // Since we mocked moderateScale to return the same value,
      // we verify the values match what was passed to moderateScale
      expect(textElement.props.style.fontSize).toBe(24);
      expect(textElement.props.style.lineHeight).toBe(32);
      expect(textElement.props.style.maxWidth).toBe(300);
    });
  });
});
