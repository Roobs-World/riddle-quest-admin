import React from "react";
import { render } from "@testing-library/react-native";
import StaticTitle from "../StaticTitle";

// Mock the style dependencies
jest.mock("../../../styles/tokens/colors", () => ({
  COLORS: {
    primaryOrange: "#FF6B00",
  },
}));

jest.mock("../../../styles/tokens/typography", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSize: {
      display: 48,
    },
  },
}));

jest.mock("../../../styles/tokens/borderRadius", () => ({
  BORDER_RADIUS: {
    lg: 12,
  },
}));

jest.mock("../../../constants/layout", () => ({
  STATIC_TITLE_PADDING_H: 20,
  STATIC_TITLE_PADDING_V: 10,
}));

jest.mock("../../../utils/responsive", () => ({
  moderateScale: jest.fn((size: number) => size),
}));

describe("StaticTitle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      expect(() => {
        render(<StaticTitle title="Test Title" />);
      }).not.toThrow();
    });

    it("should display the provided title text", () => {
      const { getByText } = render(<StaticTitle title="Riddle Quest" />);

      expect(getByText("Riddle Quest")).toBeTruthy();
    });

    it("should render with empty title", () => {
      expect(() => {
        render(<StaticTitle title="" />);
      }).not.toThrow();
    });

    it("should render with special characters in title", () => {
      const specialTitle = "Test! @#$%";
      const { getByText } = render(<StaticTitle title={specialTitle} />);

      expect(getByText(specialTitle)).toBeTruthy();
    });

    it("should render with unicode characters", () => {
      const unicodeTitle = "Hello \u2764";
      const { getByText } = render(<StaticTitle title={unicodeTitle} />);

      expect(getByText(unicodeTitle)).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("should be a valid React component", () => {
      expect(StaticTitle).toBeDefined();
      expect(typeof StaticTitle).toBe("function");
    });

    it("should create a valid React element", () => {
      const element = React.createElement(StaticTitle, { title: "Test" });

      expect(element).toBeTruthy();
      expect(element.props.title).toBe("Test");
    });
  });

  describe("Props Handling", () => {
    it("should handle long title text", () => {
      const longTitle = "A".repeat(100);
      const { getByText } = render(<StaticTitle title={longTitle} />);

      expect(getByText(longTitle)).toBeTruthy();
    });

    it("should handle whitespace in title", () => {
      const { getByText } = render(<StaticTitle title="  Spaced Title  " />);

      expect(getByText("  Spaced Title  ")).toBeTruthy();
    });

    it("should handle numeric string title", () => {
      const { getByText } = render(<StaticTitle title="12345" />);

      expect(getByText("12345")).toBeTruthy();
    });
  });

  describe("Re-rendering", () => {
    it("should update when title prop changes", () => {
      const { getByText, rerender, queryByText } = render(
        <StaticTitle title="Initial Title" />
      );

      expect(getByText("Initial Title")).toBeTruthy();

      rerender(<StaticTitle title="Updated Title" />);

      expect(queryByText("Initial Title")).toBeNull();
      expect(getByText("Updated Title")).toBeTruthy();
    });

    it("should handle multiple re-renders efficiently", () => {
      const { rerender, getByText } = render(
        <StaticTitle title="Title 1" />
      );

      for (let i = 2; i <= 5; i++) {
        rerender(<StaticTitle title={`Title ${i}`} />);
        expect(getByText(`Title ${i}`)).toBeTruthy();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle newline characters in title", () => {
      expect(() => {
        render(<StaticTitle title="Line1\nLine2" />);
      }).not.toThrow();
    });

    it("should handle tab characters in title", () => {
      expect(() => {
        render(<StaticTitle title="Tab\tTest" />);
      }).not.toThrow();
    });

    it("should render consistently across multiple instances", () => {
      const { getAllByText } = render(
        <>
          <StaticTitle title="Same Title" />
          <StaticTitle title="Same Title" />
        </>
      );

      expect(getAllByText("Same Title")).toHaveLength(2);
    });
  });

  describe("Component Lifecycle", () => {
    it("should unmount without errors", () => {
      const { unmount } = render(<StaticTitle title="Test" />);

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it("should handle rapid mount/unmount cycles", () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<StaticTitle title={`Test ${i}`} />);
        unmount();
      }

      // If we get here without errors, the test passes
      expect(true).toBe(true);
    });
  });
});
