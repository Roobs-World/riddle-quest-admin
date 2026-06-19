import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import Header from "../Header";
import {SPACING} from "../../../styles";

// Avoid ESM parsing issues from @sentry/react-native during Jest runs.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  withScope: (cb: (scope: {setExtras: jest.Mock}) => void) => cb({setExtras: jest.fn()}),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  startInactiveSpan: jest.fn(() => ({end: jest.fn()})),
}));

// Mock the CoinsDisplay component
jest.mock("../CoinsDisplay", () => {
  const React = require("react");
  const {View, Text, TouchableOpacity} = require("react-native");

  const MockCoinsDisplay = ({coins, onPress}: any) => {
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

// Mock LogoIcon (Header uses LogoIcon - path from __tests__ to components/icons)
jest.mock("../../icons/LogoIcon", () => {
  const React = require("react");
  const {View, Text} = require("react-native");

  const MockLogoIcon = () => (
    <View testID="logo-icon">
      <Text>Logo</Text>
    </View>
  );

  MockLogoIcon.displayName = "MockLogoIcon";
  return MockLogoIcon;
});

describe("Header", () => {
  const defaultProps = {
    userCoins: 25,
    onCoinsPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders header with correct structure", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      expect(getByTestId("header")).toBeTruthy();
      expect(getByTestId("header-left-side")).toBeTruthy();
      expect(getByTestId("header-right-side")).toBeTruthy();
    });

    it("renders logo button", () => {
      const {getByText} = render(<Header {...defaultProps} />);

      expect(getByText("Logo")).toBeTruthy();
    });

    it("renders logo icon", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      expect(getByTestId("logo-icon")).toBeTruthy();
    });

    it("renders coins display component", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      expect(getByTestId("coins-display")).toBeTruthy();
    });

    it("passes correct coin amount to CoinsDisplay", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={50} />);

      expect(getByText("50")).toBeTruthy();
    });

    it("renders with correct header styling", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const header = getByTestId("header");
      expect(header.props.className).toContain("w-full");
      expect(header.props.className).toContain("flex-row");
      expect(header.props.className).toContain("items-center");
      expect(header.props.className).toContain("justify-between");
      const style = header.props.style ?? {};
      expect(style.paddingHorizontal).toBeDefined();
    });
  });

  describe("Component Integration", () => {
    it("integrates CoinsDisplay with correct props", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={100} />);

      expect(getByText("100")).toBeTruthy();
    });

    it("passes onPress callback to CoinsDisplay", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
    });

    it("renders LogoIcon in left side", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const logoIcon = getByTestId("logo-icon");
      expect(logoIcon).toBeTruthy();
    });

    it("shows left side with logo", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const leftSide = getByTestId("header-left-side");
      expect(leftSide).toBeTruthy();
    });

    it("maintains right side with coins", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const rightSide = getByTestId("header-right-side");
      expect(rightSide).toBeTruthy();
    });
  });

  describe("Button Interactions", () => {
    it("calls onCoinsPress when coins display is pressed", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const coinsDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(coinsDisplay);

      expect(defaultProps.onCoinsPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple coins display presses", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const coinsDisplay = getByTestId("coins-display-touchable");
      fireEvent.press(coinsDisplay);
      fireEvent.press(coinsDisplay);

      expect(defaultProps.onCoinsPress).toHaveBeenCalledTimes(2);
    });

    it("handles undefined callback functions safely", () => {
      const {getByTestId} = render(<Header userCoins={25} onCoinsPress={undefined as any} />);

      const coinsDisplay = getByTestId("coins-display");

      expect(() => fireEvent.press(coinsDisplay)).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("has proper header accessibility properties", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const header = getByTestId("header");
      expect(header.props.accessible).toBe(true);
      expect(header.props.accessibilityRole).toBe("none");
      expect(header.props.accessibilityLabel).toBe("Game header with logo and coin balance");
    });

    it("has proper logo button accessibility properties", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const logoButton = getByTestId("logo-button");
      expect(logoButton.props.accessible).toBe(true);
      expect(logoButton.props.accessibilityRole).toBe("button");
      expect(logoButton.props.accessibilityLabel).toBe("Logo");
    });

    it("maintains accessibility structure for components", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      expect(getByTestId("logo-button")).toBeTruthy();
      expect(getByTestId("coins-display-touchable")).toBeTruthy();
    });

    it("provides accessible logo icon", () => {
      const {getByTestId} = render(<Header {...defaultProps} />);

      const logoIcon = getByTestId("logo-icon");
      expect(logoIcon).toBeTruthy();
    });
  });

  describe("Mode label", () => {
    it("shows mode label when provided", () => {
      const {getByTestId, getByText} = render(<Header {...defaultProps} modeLabel="Daily Challenge" />);

      expect(getByTestId("header-mode-label-container")).toBeTruthy();
      expect(getByTestId("header-mode-label")).toBeTruthy();
      expect(getByText("Daily Challenge")).toBeTruthy();
    });

    it("uses fallback mode label bounds before first layout measurement", () => {
      const {getByTestId} = render(<Header {...defaultProps} modeLabel="Classic" />);

      const container = getByTestId("header-mode-label-container");
      expect(container.props.style.left).toBe(SPACING.xl);
      expect(container.props.style.right).toBe(SPACING.xl);
    });

    it("recalculates mode label bounds after header and anchor layouts", () => {
      const {getByTestId} = render(<Header {...defaultProps} modeLabel="Daily Challenge" />);

      fireEvent(getByTestId("header"), "layout", {
        nativeEvent: {layout: {width: 400, height: 64, x: 0, y: 0}},
      });
      fireEvent(getByTestId("header-left-side"), "layout", {
        nativeEvent: {layout: {x: 16, width: 48, height: 48, y: 0}},
      });
      fireEvent(getByTestId("header-right-side"), "layout", {
        nativeEvent: {layout: {x: 300, width: 84, height: 32, y: 0}},
      });

      const container = getByTestId("header-mode-label-container");
      expect(container.props.style.left).toBe(64);
      expect(container.props.style.right).toBe(100);
      expect(container.props.style.transform).toEqual([{translateY: 4}]);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero coins correctly", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={0} />);

      expect(getByText("0")).toBeTruthy();
    });

    it("handles negative coins gracefully", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={-5} />);

      expect(getByText("-5")).toBeTruthy();
    });

    it("handles very large coin amounts", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={999999} />);

      expect(getByText("999999")).toBeTruthy();
    });

    it("handles decimal coin amounts", () => {
      const {getByText} = render(<Header {...defaultProps} userCoins={25.5} />);

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
      const {getByText, rerender} = render(<Header {...defaultProps} userCoins={10} />);

      expect(getByText("10")).toBeTruthy();

      rerender(<Header {...defaultProps} userCoins={50} />);

      expect(getByText("50")).toBeTruthy();
    });

    it("handles rapid prop changes efficiently", () => {
      const {rerender} = render(<Header {...defaultProps} />);

      for (let i = 0; i < 20; i++) {
        rerender(<Header {...defaultProps} userCoins={i * 10} onCoinsPress={jest.fn()} />);
      }

      expect(true).toBe(true);
    });

    it("maintains component integration through prop changes", () => {
      const {getByTestId, rerender} = render(<Header {...defaultProps} userCoins={10} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();

      rerender(<Header {...defaultProps} userCoins={20} />);

      expect(getByTestId("coins-display-touchable")).toBeTruthy();
      expect(getByTestId("logo-button")).toBeTruthy();
    });

    it("handles callback changes efficiently", () => {
      const {getByTestId, rerender} = render(<Header {...defaultProps} />);

      const newCallbacks = {
        userCoins: 25,
        onHintPress: jest.fn(),
        onCoinsPress: jest.fn(),
      };

      rerender(<Header {...newCallbacks} />);

      fireEvent.press(getByTestId("logo-button"));
      fireEvent.press(getByTestId("coins-display-touchable"));

      expect(newCallbacks.onHintPress).toHaveBeenCalledTimes(1);
      expect(newCallbacks.onCoinsPress).toHaveBeenCalledTimes(1);
    });
  });
});
