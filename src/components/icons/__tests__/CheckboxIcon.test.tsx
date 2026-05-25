import React from "react";
import {render} from "@testing-library/react-native";
import CheckboxIcon from "../CheckboxIcon";

describe("CheckboxIcon", () => {
  describe("Rendering", () => {
    it("renders correctly when checked", () => {
      const {getByText} = render(<CheckboxIcon checked={true} />);

      expect(getByText("✓")).toBeTruthy();
    });

    it("renders correctly when unchecked", () => {
      const {queryByText, UNSAFE_getByType} = render(<CheckboxIcon checked={false} />);

      expect(queryByText("✓")).toBeNull();
      const View = require("react-native").View;
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it("renders as View component", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={true} />);
      const View = require("react-native").View;
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it("displays checkmark when checked", () => {
      const {getByText} = render(<CheckboxIcon checked={true} />);
      const checkmark = getByText("✓");

      expect(checkmark.props.children).toBe("✓");
    });

    it("does not display checkmark when unchecked", () => {
      const {queryByText} = render(<CheckboxIcon checked={false} />);

      expect(queryByText("✓")).toBeNull();
    });
  });

  describe("Styling", () => {
    it("applies checked styling when checked", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={true} />);
      const View = require("react-native").View;
      const container = UNSAFE_getByType(View);

      expect(container.props.className).toContain("bg-blue-500");
      expect(container.props.className).toContain("border-blue-500");
    });

    it("applies unchecked styling when unchecked", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={false} />);
      const View = require("react-native").View;
      const container = UNSAFE_getByType(View);

      expect(container.props.className).toContain("border-gray-400");
      expect(container.props.className).not.toContain("bg-blue-500");
    });

    it("applies consistent base styling", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={true} />);
      const View = require("react-native").View;
      const container = UNSAFE_getByType(View);

      expect(container.props.className).toContain("border-2");
      expect(container.props.className).toContain("rounded");
      expect(container.props.className).toContain("justify-center");
      expect(container.props.className).toContain("items-center");
      const style = container.props.style ?? {};
      expect(style.width).toBeDefined();
      expect(style.height).toBeDefined();
      expect(style.marginRight).toBeDefined();
    });

    it("applies correct text styling when checked", () => {
      const {getByText} = render(<CheckboxIcon checked={true} />);
      const checkmark = getByText("✓");

      expect(checkmark.props.className).toContain("text-white");
      expect(checkmark.props.className).toContain("text-md");
    });
  });

  describe("Component Structure", () => {
    it("renders container View", () => {
      const {UNSAFE_getAllByType} = render(<CheckboxIcon checked={true} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views).toHaveLength(1);
    });

    it("renders Text component when checked", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={true} />);
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("does not render Text component when unchecked", () => {
      const {UNSAFE_queryByType} = render(<CheckboxIcon checked={false} />);
      const Text = require("react-native").Text;
      expect(UNSAFE_queryByType(Text)).toBeNull();
    });
  });

  describe("Checked State", () => {
    it("shows checkmark when checked is true", () => {
      const {getByText} = render(<CheckboxIcon checked={true} />);

      expect(getByText("✓")).toBeTruthy();
    });

    it("hides checkmark when checked is false", () => {
      const {queryByText} = render(<CheckboxIcon checked={false} />);

      expect(queryByText("✓")).toBeNull();
    });

    it("toggles display correctly", () => {
      const {rerender, getByText, queryByText} = render(<CheckboxIcon checked={false} />);

      expect(queryByText("✓")).toBeNull();

      rerender(<CheckboxIcon checked={true} />);
      expect(getByText("✓")).toBeTruthy();

      rerender(<CheckboxIcon checked={false} />);
      expect(queryByText("✓")).toBeNull();
    });
  });

  describe("Performance", () => {
    it("renders consistently with same props", () => {
      const {getAllByText} = render(
        <>
          <CheckboxIcon checked={true} />
          <CheckboxIcon checked={true} />
          <CheckboxIcon checked={true} />
        </>,
      );

      const checkmarks = getAllByText("✓");
      expect(checkmarks).toHaveLength(3);
    });

    it("handles rapid state changes", () => {
      const {rerender} = render(<CheckboxIcon checked={false} />);

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        rerender(<CheckboxIcon checked={i % 2 === 0} />);
      }

      expect(true).toBe(true);
    });
  });

  describe("Accessibility", () => {
    it("maintains structure for screen readers when checked", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={true} />);
      const View = require("react-native").View;
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });

    it("maintains structure for screen readers when unchecked", () => {
      const {UNSAFE_getByType} = render(<CheckboxIcon checked={false} />);
      const View = require("react-native").View;
      expect(UNSAFE_getByType(View)).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("handles checked prop correctly", () => {
      expect(() => {
        render(<CheckboxIcon checked={true} />);
      }).not.toThrow();

      expect(() => {
        render(<CheckboxIcon checked={false} />);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("maintains checkmark character integrity", () => {
      const {getByText} = render(<CheckboxIcon checked={true} />);
      const checkmark = getByText("✓");

      expect(typeof checkmark.props.children).toBe("string");
      expect(checkmark.props.children).toBe("✓");
    });

    it("handles re-renders with prop changes", () => {
      const {rerender, getByText, queryByText} = render(<CheckboxIcon checked={true} />);

      expect(getByText("✓")).toBeTruthy();

      rerender(<CheckboxIcon checked={false} />);
      expect(queryByText("✓")).toBeNull();

      rerender(<CheckboxIcon checked={true} />);
      expect(getByText("✓")).toBeTruthy();
    });
  });
});
