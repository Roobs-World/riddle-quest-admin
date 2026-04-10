import React from "react";
import { render } from "@testing-library/react-native";
import ScreenTitle from "../ScreenTitle";

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    screenTitle: {},
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
}));

describe("ScreenTitle", () => {
  describe("Rendering", () => {
    it("renders correctly with title", () => {
      const title = "Welcome";
      const { getByText } = render(<ScreenTitle title={title} />);

      expect(getByText(title)).toBeTruthy();
    });

    it("renders different titles", () => {
      const titles = [
        "Sign In",
        "Sign Up",
        "Forgot Password",
        "Profile Settings",
        "Game Statistics",
      ];

      titles.forEach((title) => {
        const { getByText } = render(<ScreenTitle title={title} />);
        expect(getByText(title)).toBeTruthy();
      });
    });

    it("renders with empty title", () => {
      const { getByText } = render(<ScreenTitle title="" />);
      expect(getByText("")).toBeTruthy();
    });

    it("renders with special characters", () => {
      const specialTitle = "Welcome! Ready to play? Let's go @#$%";
      const { getByText } = render(<ScreenTitle title={specialTitle} />);
      expect(getByText(specialTitle)).toBeTruthy();
    });

    it("renders with numbers", () => {
      const numberTitle = "Level 1 - Stage 5";
      const { getByText } = render(<ScreenTitle title={numberTitle} />);
      expect(getByText(numberTitle)).toBeTruthy();
    });
  });

  describe("Styling", () => {
    it("applies default CSS classes", () => {
      const { getByText } = render(<ScreenTitle title="Test Title" />);
      const titleElement = getByText("Test Title");

      expect(titleElement.props.className).toContain("text-center");
      expect(titleElement.props.className).toContain("font-bold");
      expect(titleElement.props.className).toContain("text-white");
      const style = Array.isArray(titleElement.props.style)
        ? Object.assign({}, ...titleElement.props.style)
        : titleElement.props.style;
      expect(style.marginBottom).toBeDefined();
    });

    it("applies custom className when provided", () => {
      const customClass = "text-blue-500 mt-4";
      const { getByText } = render(
        <ScreenTitle title="Custom Title" className={customClass} />
      );
      const titleElement = getByText("Custom Title");

      expect(titleElement.props.className).toContain(customClass);
      expect(titleElement.props.className).toContain("text-center");
    });

    it("handles className being undefined", () => {
      const { getByText } = render(<ScreenTitle title="No Class" />);
      const titleElement = getByText("No Class");

      expect(titleElement.props.className).toBeDefined();
      expect(titleElement.props.className).toContain("text-center");
    });

    it("applies style prop correctly", () => {
      const { getByText } = render(<ScreenTitle title="Styled Title" />);
      const titleElement = getByText("Styled Title");

      expect(titleElement.props.style).toBeDefined();
    });
  });

  describe("Props Handling", () => {
    it("displays exact title content", () => {
      const testTitle = "Exact Title Content";
      const { getByText } = render(<ScreenTitle title={testTitle} />);
      const titleElement = getByText(testTitle);

      expect(titleElement.props.children).toBe(testTitle);
    });

    it("handles long titles", () => {
      const longTitle =
        "This is a very long title that might wrap to multiple lines and should still be rendered correctly without issues";
      const { getByText } = render(<ScreenTitle title={longTitle} />);

      expect(getByText(longTitle)).toBeTruthy();
    });

    it("handles short titles", () => {
      const shortTitle = "Hi";
      const { getByText } = render(<ScreenTitle title={shortTitle} />);

      expect(getByText(shortTitle)).toBeTruthy();
    });

    it("handles single character titles", () => {
      const singleChar = "X";
      const { getByText } = render(<ScreenTitle title={singleChar} />);

      expect(getByText(singleChar)).toBeTruthy();
    });
  });

  describe("className Combinations", () => {
    it("merges custom className with default classes", () => {
      const customClass = "text-red-500";
      const { getByText } = render(
        <ScreenTitle title="Merged Classes" className={customClass} />
      );
      const titleElement = getByText("Merged Classes");

      // Should have both default and custom classes
      expect(titleElement.props.className).toContain("text-center");
      expect(titleElement.props.className).toContain(customClass);
    });

    it("handles multiple custom classes", () => {
      const multipleClasses = "text-blue-500 mt-8 border-b";
      const { getByText } = render(
        <ScreenTitle title="Multiple Classes" className={multipleClasses} />
      );
      const titleElement = getByText("Multiple Classes");

      expect(titleElement.props.className).toContain("text-blue-500");
      expect(titleElement.props.className).toContain("mt-8");
      expect(titleElement.props.className).toContain("border-b");
    });

    it("handles empty string className", () => {
      const { getByText } = render(
        <ScreenTitle title="Empty Class" className="" />
      );
      const titleElement = getByText("Empty Class");

      expect(titleElement.props.className).toContain("text-center");
    });
  });

  describe("Component Structure", () => {
    it("renders as Text component", () => {
      const { UNSAFE_getByType } = render(
        <ScreenTitle title="Structure Test" />
      );
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("renders single text element", () => {
      const { UNSAFE_getAllByType } = render(
        <ScreenTitle title="Single Element" />
      );
      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);

      expect(textElements).toHaveLength(1);
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when title changes", () => {
      const { rerender, getByText } = render(
        <ScreenTitle title="Initial Title" />
      );

      expect(getByText("Initial Title")).toBeTruthy();

      rerender(<ScreenTitle title="Updated Title" />);
      expect(getByText("Updated Title")).toBeTruthy();
    });

    it("re-renders correctly when className changes", () => {
      const { rerender, getByText } = render(
        <ScreenTitle title="Same Title" className="initial-class" />
      );

      let titleElement = getByText("Same Title");
      expect(titleElement.props.className).toContain("initial-class");

      rerender(<ScreenTitle title="Same Title" className="updated-class" />);
      titleElement = getByText("Same Title");
      expect(titleElement.props.className).toContain("updated-class");
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(<ScreenTitle title="Title 1" />);

      // Rapid updates
      for (let i = 2; i <= 10; i++) {
        rerender(<ScreenTitle title={`Title ${i}`} className={`class-${i}`} />);
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text for screen readers", () => {
      const title = "Accessible Title";
      const { getByText } = render(<ScreenTitle title={title} />);
      const titleElement = getByText(title);

      expect(titleElement).toBeTruthy();
      expect(titleElement.props.children).toBe(title);
    });

    it("maintains text semantics", () => {
      const { UNSAFE_getByType } = render(
        <ScreenTitle title="Semantic Title" />
      );
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles title with line breaks", () => {
      const multilineTitle = "Line 1\nLine 2";
      const { getByText } = render(<ScreenTitle title={multilineTitle} />);

      expect(getByText(multilineTitle)).toBeTruthy();
    });

    it("handles title with unicode characters", () => {
      const unicodeTitle = "Welcome 👋 to Qwordly 🎮";
      const { getByText } = render(<ScreenTitle title={unicodeTitle} />);

      expect(getByText(unicodeTitle)).toBeTruthy();
    });

    it("handles title with HTML entities", () => {
      const entityTitle = "A & B > C < D";
      const { getByText } = render(<ScreenTitle title={entityTitle} />);

      expect(getByText(entityTitle)).toBeTruthy();
    });
  });
});
