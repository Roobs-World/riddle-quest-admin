import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import CoinsDisplay from "../CoinsDisplay";

// Mock react-native-svg
jest.mock("react-native-svg", () => ({
  SvgXml: (props: any) => {
    return require("react").createElement("View", { testID: props.testID });
  },
}));

describe("CoinsDisplay", () => {
  const defaultProps = {
    coins: 25,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders coin amount correctly", () => {
      const { getByText } = render(<CoinsDisplay {...defaultProps} />);

      expect(getByText("25")).toBeTruthy();
    });

    it("renders coin icon", () => {
      const { getByTestId } = render(<CoinsDisplay {...defaultProps} />);

      expect(getByTestId("coin-icon")).toBeTruthy();
    });

    it("renders with correct layout when not touchable", () => {
      const { getByTestId } = render(<CoinsDisplay {...defaultProps} />);

      const coinsDisplay = getByTestId("coins-display");
      expect(coinsDisplay.props.className).toContain("flex-row");
      expect(coinsDisplay.props.className).toContain("items-center");
    });

    it("renders with touchable layout when onPress provided", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
    });

    it("shows zero coins correctly", () => {
      const { getByText } = render(<CoinsDisplay coins={0} />);

      expect(getByText("0")).toBeTruthy();
    });

    it("shows large coin amounts correctly", () => {
      const { getByText } = render(<CoinsDisplay coins={999999} />);

      expect(getByText("999999")).toBeTruthy();
    });
  });

  describe("Touchable vs Non-Touchable Behavior", () => {
    it("renders as non-touchable when no onPress provided", () => {
      const { queryByTestId, getByTestId } = render(
        <CoinsDisplay {...defaultProps} />
      );

      expect(queryByTestId("coins-display-touchable")).toBeNull();
      expect(getByTestId("coins-display")).toBeTruthy();
    });

    it("renders as touchable when onPress provided", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
      expect(getByTestId("coins-display")).toBeTruthy(); // Content is still rendered inside
    });

    it("applies correct styling for touchable version", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      const touchableDisplay = getByTestId("coins-display-touchable");
      expect(touchableDisplay).toBeTruthy();
      expect(touchableDisplay.props.accessibilityRole).toBe("button");
    });

    it("applies correct styling for non-touchable version", () => {
      const { getByTestId } = render(<CoinsDisplay {...defaultProps} />);

      const staticDisplay = getByTestId("coins-display");
      expect(staticDisplay.props.className).toContain("flex-row");
      expect(staticDisplay.props.className).toContain("items-center");
    });
  });

  describe("Button Interactions", () => {
    it("calls onPress when touchable version is pressed", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      const touchableDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(touchableDisplay);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple presses correctly", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      const touchableDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(touchableDisplay);
      fireEvent.press(touchableDisplay);
      fireEvent.press(touchableDisplay);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });

    it("handles undefined onPress gracefully", () => {
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={undefined as any} />
      );

      // When onPress is undefined, it renders as non-touchable
      expect(getByTestId("coins-display")).toBeTruthy();

      expect(() => {
        fireEvent.press(getByTestId("coins-display"));
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility properties for touchable version", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      const touchableDisplay = getByTestId("coins-display-touchable");
      expect(touchableDisplay.props.accessible).toBe(true);
      expect(touchableDisplay.props.accessibilityRole).toBe("button");
      expect(touchableDisplay.props.accessibilityLabel).toContain(
        "Open coin shop"
      );
      expect(touchableDisplay.props.accessibilityLabel).toContain("25 coins");
    });

    it("has proper accessibility properties for non-touchable version", () => {
      const { getByTestId } = render(<CoinsDisplay {...defaultProps} />);

      const staticDisplay = getByTestId("coins-display");
      expect(staticDisplay.props.accessible).toBe(true);
      expect(staticDisplay.props.accessibilityLabel).toContain("25 coins");
    });

    it("updates accessibility label when coin amount changes", () => {
      const mockOnPress = jest.fn();
      const { getByTestId, rerender } = render(
        <CoinsDisplay coins={10} onPress={mockOnPress} />
      );

      let touchableDisplay = getByTestId("coins-display-touchable");
      expect(touchableDisplay.props.accessibilityLabel).toContain("10 coins");

      rerender(<CoinsDisplay coins={50} onPress={mockOnPress} />);

      touchableDisplay = getByTestId("coins-display-touchable");
      expect(touchableDisplay.props.accessibilityLabel).toContain("50 coins");
    });

    it("handles singular vs plural coin text correctly", () => {
      const { getByTestId, rerender } = render(<CoinsDisplay coins={1} />);

      let coinsDisplay = getByTestId("coins-display");
      expect(coinsDisplay.props.accessibilityLabel).toContain("1 coin");

      rerender(<CoinsDisplay coins={2} />);
      coinsDisplay = getByTestId("coins-display");
      expect(coinsDisplay.props.accessibilityLabel).toContain("2 coins");
    });

    it("handles coin icon accessibility", () => {
      const { getByTestId } = render(<CoinsDisplay {...defaultProps} />);

      const coinIcon = getByTestId("coin-icon");
      expect(coinIcon).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles negative coin amounts", () => {
      const { getByText } = render(<CoinsDisplay coins={-5} />);

      expect(getByText("-5")).toBeTruthy();
    });

    it("handles very large coin amounts", () => {
      const { getByText } = render(<CoinsDisplay coins={1000000} />);

      expect(getByText("1000000")).toBeTruthy();
    });

    it("handles decimal coin amounts", () => {
      const { getByText } = render(<CoinsDisplay coins={25.5} />);

      expect(getByText("25.5")).toBeTruthy();
    });

    it("handles undefined coin amount gracefully", () => {
      expect(() => {
        render(<CoinsDisplay coins={undefined as any} />);
      }).not.toThrow();
    });

    it("handles null coin amount gracefully", () => {
      expect(() => {
        render(<CoinsDisplay coins={null as any} />);
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("updates correctly when coin amount changes", () => {
      const { getByText, rerender } = render(<CoinsDisplay coins={10} />);

      expect(getByText("10")).toBeTruthy();

      rerender(<CoinsDisplay coins={25} />);

      expect(getByText("25")).toBeTruthy();
    });

    it("handles rapid coin amount changes efficiently", () => {
      const { rerender } = render(<CoinsDisplay coins={0} />);

      // Simulate rapid coin changes
      for (let i = 0; i < 50; i++) {
        rerender(<CoinsDisplay coins={i} />);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });

    it("handles rapid press events efficiently", () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <CoinsDisplay {...defaultProps} onPress={mockOnPress} />
      );

      const touchableDisplay = getByTestId("coins-display-touchable");

      // Simulate rapid button presses
      for (let i = 0; i < 10; i++) {
        fireEvent.press(touchableDisplay);
      }

      expect(mockOnPress).toHaveBeenCalledTimes(10);
    });

    it("maintains state consistency during prop changes", () => {
      const mockOnPress = jest.fn();
      const { getByTestId, rerender } = render(
        <CoinsDisplay coins={10} onPress={mockOnPress} />
      );

      // Should remain touchable through prop changes
      expect(getByTestId("coins-display-touchable")).toBeTruthy();

      rerender(<CoinsDisplay coins={20} onPress={mockOnPress} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();

      rerender(<CoinsDisplay coins={30} />);

      expect(getByTestId("coins-display")).toBeTruthy();
    });
  });
});
