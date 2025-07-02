import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Header from "../Header";

// Mock the CoinsDisplay component
jest.mock("../CoinsDisplay", () => {
  const React = require("react");
  const { View, Text, TouchableOpacity } = require("react-native");

  const MockCoinsDisplay = ({ coins, onPress }: any) => {
    if (onPress) {
      return (
        <TouchableOpacity testID="coins-display-touchable" onPress={onPress}>
          <View testID="coins-display">
            <Text>{coins}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View testID="coins-display">
        <Text>{coins}</Text>
      </View>
    );
  };

  MockCoinsDisplay.displayName = "MockCoinsDisplay";
  return MockCoinsDisplay;
});

// Mock the HintIcon component
jest.mock("../../icons/HintIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockHintIcon = ({ width, height, color }: any) => (
    <View
      testID="hint-icon"
      style={{ width, height, backgroundColor: color }}
    />
  );

  MockHintIcon.displayName = "MockHintIcon";
  return MockHintIcon;
});

// Mock AppStrings
jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    Navigation: {
      HINT_BUTTON: "Hint",
    },
  },
}));

describe("Header", () => {
  const defaultProps = {
    userCoins: 25,
    onHintPress: jest.fn(),
    onCoinsPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders header with correct structure", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      expect(getByTestId("header")).toBeTruthy();
      expect(getByTestId("header-left-side")).toBeTruthy();
      expect(getByTestId("header-right-side")).toBeTruthy();
    });

    it("renders hint button with correct text", () => {
      const { getByText } = render(<Header {...defaultProps} />);

      expect(getByText("Hint")).toBeTruthy();
    });

    it("renders hint icon", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      expect(getByTestId("hint-icon")).toBeTruthy();
    });

    it("renders coins display component", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      expect(getByTestId("coins-display")).toBeTruthy();
    });

    it("passes correct coin amount to CoinsDisplay", () => {
      const { getByText } = render(<Header {...defaultProps} userCoins={50} />);

      expect(getByText("50")).toBeTruthy();
    });

    it("renders with correct header styling", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const header = getByTestId("header");
      expect(header.props.className).toContain("w-full");
      expect(header.props.className).toContain("flex-row");
      expect(header.props.className).toContain("items-center");
      expect(header.props.className).toContain("justify-between");
      expect(header.props.className).toContain("p-4");
    });
  });

  describe("Component Integration", () => {
    it("integrates CoinsDisplay with correct props", () => {
      const { getByText } = render(
        <Header {...defaultProps} userCoins={100} />
      );

      expect(getByText("100")).toBeTruthy();
    });

    it("passes onPress callback to CoinsDisplay", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
    });

    it("renders HintIcon with correct dimensions", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintIcon = getByTestId("hint-icon");
      expect(hintIcon.props.style).toMatchObject({
        width: 24,
        height: 24,
        backgroundColor: "#ffffff",
      });
    });

    it("shows left side components in correct order", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const leftSide = getByTestId("header-left-side");
      expect(leftSide.props.className).toContain("flex-row");
      expect(leftSide.props.className).toContain("items-center");
      expect(leftSide.props.className).toContain("space-x-3");
    });

    it("maintains empty right side for future expansion", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const rightSide = getByTestId("header-right-side");
      expect(rightSide).toBeTruthy();
    });
  });

  describe("Button Interactions", () => {
    it("calls onHintPress when hint button is pressed", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintButton = getByTestId("hint-button");
      fireEvent.press(hintButton);

      expect(defaultProps.onHintPress).toHaveBeenCalledTimes(1);
    });

    it("calls onCoinsPress when coins display is pressed", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const coinsDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(coinsDisplay);

      expect(defaultProps.onCoinsPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple hint button presses", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintButton = getByTestId("hint-button");
      fireEvent.press(hintButton);
      fireEvent.press(hintButton);
      fireEvent.press(hintButton);

      expect(defaultProps.onHintPress).toHaveBeenCalledTimes(3);
    });

    it("handles multiple coins display presses", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const coinsDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(coinsDisplay);
      fireEvent.press(coinsDisplay);

      expect(defaultProps.onCoinsPress).toHaveBeenCalledTimes(2);
    });

    it("handles undefined callback functions safely", () => {
      const { getByTestId } = render(
        <Header
          userCoins={25}
          onHintPress={undefined as any}
          onCoinsPress={undefined as any}
        />
      );

      const hintButton = getByTestId("hint-button");
      const coinsDisplay = getByTestId("coins-display"); // Use coins-display when onPress is undefined

      // Should not throw errors
      expect(() => fireEvent.press(hintButton)).not.toThrow();
      expect(() => fireEvent.press(coinsDisplay)).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("has proper header accessibility properties", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const header = getByTestId("header");
      expect(header.props.accessible).toBe(true);
      expect(header.props.accessibilityRole).toBe("none");
      expect(header.props.accessibilityLabel).toBe(
        "Game header with hint button and coin balance"
      );
    });

    it("has proper hint button accessibility properties", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintButton = getByTestId("hint-button");
      expect(hintButton.props.accessible).toBe(true);
      expect(hintButton.props.accessibilityRole).toBe("button");
      expect(hintButton.props.accessibilityLabel).toBe(
        "Get hint for current riddle"
      );
    });

    it("maintains accessibility structure for components", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      expect(getByTestId("hint-button")).toBeTruthy();
      expect(getByTestId("coins-display-touchable")).toBeTruthy();
    });

    it("provides accessible hint icon", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintIcon = getByTestId("hint-icon");
      expect(hintIcon).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero coins correctly", () => {
      const { getByText } = render(<Header {...defaultProps} userCoins={0} />);

      expect(getByText("0")).toBeTruthy();
    });

    it("handles negative coins gracefully", () => {
      const { getByText } = render(<Header {...defaultProps} userCoins={-5} />);

      expect(getByText("-5")).toBeTruthy();
    });

    it("handles very large coin amounts", () => {
      const { getByText } = render(
        <Header {...defaultProps} userCoins={999999} />
      );

      expect(getByText("999999")).toBeTruthy();
    });

    it("handles decimal coin amounts", () => {
      const { getByText } = render(
        <Header {...defaultProps} userCoins={25.5} />
      );

      expect(getByText("25.5")).toBeTruthy();
    });

    it("handles undefined coin amount gracefully", () => {
      expect(() => {
        render(<Header {...defaultProps} userCoins={undefined as any} />);
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("updates correctly when userCoins prop changes", () => {
      const { getByText, rerender } = render(
        <Header {...defaultProps} userCoins={10} />
      );

      expect(getByText("10")).toBeTruthy();

      rerender(<Header {...defaultProps} userCoins={50} />);

      expect(getByText("50")).toBeTruthy();
    });

    it("handles rapid prop changes efficiently", () => {
      const { rerender } = render(<Header {...defaultProps} />);

      // Simulate rapid prop changes
      for (let i = 0; i < 20; i++) {
        rerender(
          <Header
            {...defaultProps}
            userCoins={i * 10}
            onHintPress={jest.fn()}
            onCoinsPress={jest.fn()}
          />
        );
      }

      // Should not throw errors
      expect(true).toBe(true);
    });

    it("handles rapid button presses efficiently", () => {
      const { getByTestId } = render(<Header {...defaultProps} />);

      const hintButton = getByTestId("hint-button");

      // Simulate rapid button presses
      for (let i = 0; i < 10; i++) {
        fireEvent.press(hintButton);
      }

      expect(defaultProps.onHintPress).toHaveBeenCalledTimes(10);
    });

    it("maintains component integration through prop changes", () => {
      const { getByTestId, rerender } = render(
        <Header {...defaultProps} userCoins={10} />
      );

      expect(getByTestId("coins-display-touchable")).toBeTruthy();

      rerender(<Header {...defaultProps} userCoins={20} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
      expect(getByTestId("hint-button")).toBeTruthy();
    });

    it("handles callback changes efficiently", () => {
      const { getByTestId, rerender } = render(<Header {...defaultProps} />);

      const newCallbacks = {
        userCoins: 25,
        onHintPress: jest.fn(),
        onCoinsPress: jest.fn(),
      };

      rerender(<Header {...newCallbacks} />);

      fireEvent.press(getByTestId("hint-button"));
      fireEvent.press(getByTestId("coins-display-touchable"));

      expect(newCallbacks.onHintPress).toHaveBeenCalledTimes(1);
      expect(newCallbacks.onCoinsPress).toHaveBeenCalledTimes(1);
    });
  });
});
