import React from "react";
import {render} from "@testing-library/react-native";
import Subtitle from "../Subtitle";

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    subtitle: {},
  },
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48},
}));

describe("Subtitle", () => {
  describe("Rendering", () => {
    it("renders correctly with subtitle text", () => {
      const subtitleText = "This is a subtitle";
      const {getByText} = render(<Subtitle text={subtitleText} />);

      expect(getByText(subtitleText)).toBeTruthy();
    });

    it("renders with different subtitle content", () => {
      const subtitles = [
        "Welcome to the app",
        "Enter your details below",
        "Complete your profile",
        "Choose your preferences",
        "Start your journey",
      ];

      subtitles.forEach((subtitle) => {
        const {getByText} = render(<Subtitle text={subtitle} />);
        expect(getByText(subtitle)).toBeTruthy();
      });
    });

    it("renders with empty text", () => {
      const {getByText} = render(<Subtitle text="" />);
      expect(getByText("")).toBeTruthy();
    });

    it("renders with special characters", () => {
      const specialText = "Welcome! Ready to start? Let's go @#$%";
      const {getByText} = render(<Subtitle text={specialText} />);
      expect(getByText(specialText)).toBeTruthy();
    });

    it("renders with multiline content", () => {
      const multilineText = "Line 1\nLine 2\nLine 3";
      const {getByText} = render(<Subtitle text={multilineText} />);
      expect(getByText(multilineText)).toBeTruthy();
    });
  });

  describe("Text Properties", () => {
    it("renders as Text component", () => {
      const {UNSAFE_getByType} = render(<Subtitle text="Test subtitle" />);
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("applies correct CSS classes", () => {
      const {getByText} = render(<Subtitle text="Test subtitle" />);
      const subtitleText = getByText("Test subtitle");

      // Check if the component applies the correct style classes
      expect(subtitleText.props.className).toContain("text-center");
      expect(subtitleText.props.className).toContain("text-white");
    });

    it("applies custom styles correctly", () => {
      const {getByText} = render(<Subtitle text="Styled subtitle" />);
      const subtitleElement = getByText("Styled subtitle");

      // Should have the style prop applied
      expect(subtitleElement.props.style).toBeDefined();
    });
  });

  describe("Content Handling", () => {
    it("renders exact text content", () => {
      const testText = "Exact content validation";
      const {getByText} = render(<Subtitle text={testText} />);

      const subtitleElement = getByText(testText);
      expect(subtitleElement.props.children).toBe(testText);
    });

    it("handles long subtitle text", () => {
      const longText =
        "This is a very long subtitle that might span multiple lines and should still be rendered correctly without any issues in the component.";
      const {getByText} = render(<Subtitle text={longText} />);

      expect(getByText(longText)).toBeTruthy();
    });

    it("handles short subtitle text", () => {
      const shortText = "Hi";
      const {getByText} = render(<Subtitle text={shortText} />);

      expect(getByText(shortText)).toBeTruthy();
    });

    it("handles single character text", () => {
      const singleChar = "X";
      const {getByText} = render(<Subtitle text={singleChar} />);

      expect(getByText(singleChar)).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text for screen readers", () => {
      const subtitleText = "Accessible subtitle";
      const {getByText} = render(<Subtitle text={subtitleText} />);
      const subtitleElement = getByText(subtitleText);

      // Subtitle text should be accessible
      expect(subtitleElement).toBeTruthy();
      expect(subtitleElement.props.children).toBe(subtitleText);
    });

    it("maintains text semantics for assistive technology", () => {
      const {UNSAFE_getByType} = render(<Subtitle text="Subtitle text" />);
      const Text = require("react-native").Text;
      const textElement = UNSAFE_getByType(Text);

      // Should render as a Text component for proper semantics
      expect(textElement).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when text prop changes", () => {
      const {rerender, getByText} = render(<Subtitle text="Initial subtitle" />);

      expect(getByText("Initial subtitle")).toBeTruthy();

      rerender(<Subtitle text="Updated subtitle" />);
      expect(getByText("Updated subtitle")).toBeTruthy();
    });

    it("handles rapid text updates", () => {
      const {rerender} = render(<Subtitle text="Subtitle 1" />);

      // Rapid updates should not throw errors
      for (let i = 2; i <= 10; i++) {
        rerender(<Subtitle text={`Subtitle ${i}`} />);
      }

      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe("Component Structure", () => {
    it("maintains consistent component structure", () => {
      const {getByText} = render(<Subtitle text="Test" />);
      const subtitleElement = getByText("Test");

      // Should be a single Text element (RCTText in React Native test env)
      expect(subtitleElement).toBeTruthy();
      expect(["Text", "RCTText"]).toContain(subtitleElement.type);
    });
  });

  describe("Styling", () => {
    it("has consistent text styling", () => {
      const {getByText} = render(<Subtitle text="Styled text" />);
      const element = getByText("Styled text");

      expect(element.props.className).toBeDefined();
      expect(element.props.className).toContain("text-white");
    });

    it("maintains center alignment", () => {
      const {getByText} = render(<Subtitle text="Centered text" />);
      const element = getByText("Centered text");

      expect(element.props.className).toContain("text-center");
    });

    it("maintains bottom margin", () => {
      const {getByText} = render(<Subtitle text="Spaced text" />);
      const element = getByText("Spaced text");

      const style = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(style.marginBottom).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles text with numbers", () => {
      const numberedText = "Step 1 of 5";
      const {getByText} = render(<Subtitle text={numberedText} />);

      expect(getByText(numberedText)).toBeTruthy();
    });

    it("handles text with punctuation", () => {
      const punctuatedText = "Hello, world! How are you?";
      const {getByText} = render(<Subtitle text={punctuatedText} />);

      expect(getByText(punctuatedText)).toBeTruthy();
    });

    it("handles text with unicode characters", () => {
      const unicodeText = "Hello 👋 World 🌍";
      const {getByText} = render(<Subtitle text={unicodeText} />);

      expect(getByText(unicodeText)).toBeTruthy();
    });
  });
});
