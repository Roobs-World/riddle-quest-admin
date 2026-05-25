import React from "react";
import {render} from "@testing-library/react-native";
import BackIcon from "../BackIcon";

describe("BackIcon", () => {
  describe("Rendering", () => {
    it("renders correctly", () => {
      const {getByText} = render(<BackIcon />);

      expect(getByText("<")).toBeTruthy();
    });

    it("renders as Text component", () => {
      const {UNSAFE_getByType} = render(<BackIcon />);
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("displays correct arrow character", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon.props.children).toBe("<");
    });
  });

  describe("Styling", () => {
    it("has correct CSS classes applied", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon.props.className).toContain("text-gray-700");
      expect(backIcon.props.className).toContain("text-5xl");
      expect(backIcon.props.className).toContain("font-poppins-light");
    });

    it("applies all required styles", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      const className = backIcon.props.className;
      expect(className).toBeDefined();
      expect(typeof className).toBe("string");
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text content", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon).toBeTruthy();
      expect(backIcon.props.children).toBe("<");
    });

    it("maintains text semantics for screen readers", () => {
      const {UNSAFE_getByType} = render(<BackIcon />);
      const Text = require("react-native").Text;
      const textElement = UNSAFE_getByType(Text);

      expect(textElement).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("renders single Text element", () => {
      const {UNSAFE_getAllByType} = render(<BackIcon />);
      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);

      expect(textElements).toHaveLength(1);
    });

    it("has no children elements", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      // Should only contain the arrow character
      expect(backIcon.props.children).toBe("<");
    });
  });

  describe("Performance", () => {
    it("renders consistently across multiple instances", () => {
      const {getAllByText} = render(
        <>
          <BackIcon />
          <BackIcon />
          <BackIcon />
        </>,
      );

      const backIcons = getAllByText("<");
      expect(backIcons).toHaveLength(3);

      backIcons.forEach((icon) => {
        expect(icon.props.children).toBe("<");
      });
    });

    it("handles rapid re-renders", () => {
      const {rerender} = render(<BackIcon />);

      // Rapid re-renders should not throw errors
      for (let i = 0; i < 10; i++) {
        rerender(<BackIcon />);
      }

      expect(true).toBe(true);
    });
  });

  describe("Visual Consistency", () => {
    it("maintains consistent styling", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      const className = backIcon.props.className;
      expect(className).toContain("text-gray-700");
      expect(className).toContain("text-5xl");
      expect(className).toContain("font-poppins-light");
    });

    it("uses expected font styling", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon.props.className).toContain("font-poppins-light");
    });

    it("uses expected text size", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon.props.className).toContain("text-5xl");
    });

    it("uses expected text color", () => {
      const {getByText} = render(<BackIcon />);
      const backIcon = getByText("<");

      expect(backIcon.props.className).toContain("text-gray-700");
    });
  });

  describe("Content Validation", () => {
    it("renders exact arrow character", () => {
      const {getByText} = render(<BackIcon />);

      expect(getByText("<")).toBeTruthy();
    });

    it("does not render other characters", () => {
      const {queryByText} = render(<BackIcon />);

      expect(queryByText(">")).toBeNull();
      expect(queryByText("←")).toBeNull();
      expect(queryByText("back")).toBeNull();
    });
  });
});
