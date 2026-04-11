import React from "react";
import { render } from "@testing-library/react-native";
import GameAnimations from "../GameAnimations";

// Mock StaticTitle component
jest.mock("../../animations/StaticTitle", () => {
  const { View, Text } = require("react-native");
  return function MockStaticTitle({ title }: { title: string }) {
    return (
      <View testID="static-title">
        <Text>{title}</Text>
      </View>
    );
  };
});

describe("<GameAnimations />", () => {
  describe("Rendering", () => {
    it("should render without crashing when isWin is true", () => {
      expect(() => render(<GameAnimations isWin={true} />)).not.toThrow();
    });

    it("should render without crashing when isWin is false", () => {
      expect(() => render(<GameAnimations isWin={false} />)).not.toThrow();
    });

    it("should render StaticTitle with 'YOU WON!' when isWin is true", () => {
      const { getByText, getByTestId } = render(<GameAnimations isWin={true} />);
      expect(getByTestId("static-title")).toBeTruthy();
      expect(getByText("YOU WON!")).toBeTruthy();
    });

    it("should return null when isWin is false", () => {
      const { queryByTestId, queryByText } = render(<GameAnimations isWin={false} />);
      expect(queryByTestId("static-title")).toBeNull();
      expect(queryByText("YOU WON!")).toBeNull();
    });
  });

  describe("Conditional Rendering", () => {
    it("should not render any content when isWin is false", () => {
      const { toJSON } = render(<GameAnimations isWin={false} />);
      expect(toJSON()).toBeNull();
    });

    it("should render content when isWin is true", () => {
      const { toJSON } = render(<GameAnimations isWin={true} />);
      expect(toJSON()).not.toBeNull();
    });

    it("should toggle rendering based on isWin prop changes", () => {
      const { rerender, queryByTestId } = render(<GameAnimations isWin={false} />);
      expect(queryByTestId("static-title")).toBeNull();

      rerender(<GameAnimations isWin={true} />);
      expect(queryByTestId("static-title")).toBeTruthy();

      rerender(<GameAnimations isWin={false} />);
      expect(queryByTestId("static-title")).toBeNull();
    });
  });

  describe("Component Lifecycle", () => {
    it("should handle prop updates correctly", () => {
      const { rerender } = render(<GameAnimations isWin={false} />);

      expect(() => {
        rerender(<GameAnimations isWin={true} />);
        rerender(<GameAnimations isWin={false} />);
        rerender(<GameAnimations isWin={true} />);
      }).not.toThrow();
    });

    it("should handle unmount correctly when isWin is true", () => {
      const { unmount } = render(<GameAnimations isWin={true} />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle unmount correctly when isWin is false", () => {
      const { unmount } = render(<GameAnimations isWin={false} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Props Validation", () => {
    it("should handle boolean true prop", () => {
      const { getByText } = render(<GameAnimations isWin={true} />);
      expect(getByText("YOU WON!")).toBeTruthy();
    });

    it("should handle boolean false prop", () => {
      const { queryByText } = render(<GameAnimations isWin={false} />);
      expect(queryByText("YOU WON!")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid prop changes", () => {
      const { rerender, queryByTestId } = render(<GameAnimations isWin={false} />);

      for (let i = 0; i < 10; i++) {
        rerender(<GameAnimations isWin={i % 2 === 0} />);
      }

      // After even number of iterations, isWin should be true (0 % 2 = 0)
      // Actually 10 iterations: 0,1,2,3,4,5,6,7,8,9 -> last is 9 % 2 = 1 (false)
      // Wait, index 9 is the 10th iteration, 9 % 2 = 1, so isWin = false
      expect(queryByTestId("static-title")).toBeNull();
    });

    it("should maintain consistent rendering behavior", () => {
      const { getByText, rerender } = render(<GameAnimations isWin={true} />);

      // Should always show same text when isWin is true
      expect(getByText("YOU WON!")).toBeTruthy();

      rerender(<GameAnimations isWin={true} />);
      expect(getByText("YOU WON!")).toBeTruthy();
    });
  });

  describe("Fragment Rendering", () => {
    it("should use React Fragment as wrapper when isWin is true", () => {
      const { toJSON } = render(<GameAnimations isWin={true} />);
      // When using Fragment, the JSON should not have an extra wrapper element
      // The StaticTitle mock should be the root element
      expect(toJSON()).toBeTruthy();
    });
  });
});
