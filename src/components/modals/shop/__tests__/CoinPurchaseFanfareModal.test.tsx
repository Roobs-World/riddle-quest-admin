import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import CoinPurchaseFanfareModal from "../CoinPurchaseFanfareModal";

// Mock Animated to avoid native module errors and enable testing animation behavior
jest.mock("react-native/Libraries/Animated/Animated", () => {
  const { View } = require("react-native");
  class MockAnimatedValue {
    private _value: number;
    setValue = jest.fn((val: number) => {
      this._value = val;
    });
    stopAnimation = jest.fn((callback?: (value: number) => void) => {
      callback?.(this._value);
    });
    constructor(initial: number) {
      this._value = initial;
    }
    interpolate(config: { inputRange: number[]; outputRange: string[] }) {
      return config?.outputRange?.[0] ?? "0deg";
    }
  }
  const simpleAnim = () => ({ start: jest.fn(), stop: jest.fn() });
  const Animated = {
    View,
    Value: MockAnimatedValue,
    timing: jest.fn(simpleAnim),
    sequence: jest.fn(simpleAnim),
    loop: jest.fn(simpleAnim),
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
  };
});

// Mock Modal to avoid NativeEventEmitter/Keyboard native module errors
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({
      children,
      visible,
      onRequestClose,
    }: {
      children: React.ReactNode;
      visible: boolean;
      onRequestClose?: () => void;
    }) {
      if (!visible) return null;
      return React.createElement(
        "View",
        { testID: "modal", onRequestClose },
        children
      );
    },
  };
});

// Mock WideButton component
jest.mock("../../../buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({
    buttonText,
    onPress,
  }: {
    buttonText: string;
    onPress: () => void;
  }) {
    return React.createElement(
      "View",
      { testID: "wide-button", accessible: true, onPress },
      React.createElement("Text", null, buttonText)
    );
  };
});

// Mock SVG components
jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock(
  "../../../../assets/images/large-coin-stack.svg",
  () => "LargeCoinStackSvg"
);

describe("CoinPurchaseFanfareModal", () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    isVisible: true,
    coinsPurchased: 100,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByText("Coins Added!")).toBeTruthy();
      expect(getByText("+100 Coins")).toBeTruthy();
      expect(getByText("Awesome")).toBeTruthy();
    });

    it("should not render content when not visible", () => {
      const { queryByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      expect(queryByText("Coins Added!")).toBeNull();
      expect(queryByText("+100 Coins")).toBeNull();
    });

    it("should render without crashing when visible", () => {
      expect(() =>
        render(<CoinPurchaseFanfareModal {...defaultProps} />)
      ).not.toThrow();
    });

    it("should render without crashing when not visible", () => {
      expect(() =>
        render(<CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();
    });
  });

  describe("Coins Display", () => {
    it("should display the correct number of coins purchased", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={250} />
      );

      expect(getByText("+250 Coins")).toBeTruthy();
    });

    it("should handle zero coins", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={0} />
      );

      expect(getByText("+0 Coins")).toBeTruthy();
    });

    it("should handle large coin amounts", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={999999} />
      );

      expect(getByText("+999999 Coins")).toBeTruthy();
    });

    it("should handle single coin", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={1} />
      );

      expect(getByText("+1 Coins")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onClose when Awesome button is pressed", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      fireEvent.press(getByText("Awesome"));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when not pressed", () => {
      render(<CoinPurchaseFanfareModal {...defaultProps} />);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Props Handling", () => {
    it("should handle all required props correctly", () => {
      expect(() =>
        render(
          <CoinPurchaseFanfareModal
            isVisible={true}
            coinsPurchased={50}
            onClose={mockOnClose}
          />
        )
      ).not.toThrow();
    });

    it("should handle different onClose callbacks", () => {
      const customOnClose = jest.fn();
      const { getByText } = render(
        <CoinPurchaseFanfareModal
          {...defaultProps}
          onClose={customOnClose}
        />
      );

      fireEvent.press(getByText("Awesome"));

      expect(customOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Visibility Behavior", () => {
    it("should handle visibility state changes", () => {
      const { queryByText, rerender } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      expect(queryByText("Coins Added!")).toBeNull();

      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);

      expect(queryByText("Coins Added!")).toBeTruthy();
    });

    it("should handle toggling visibility multiple times", () => {
      const { queryByText, rerender } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />
      );

      expect(queryByText("Coins Added!")).toBeTruthy();

      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />);
      expect(queryByText("Coins Added!")).toBeNull();

      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);
      expect(queryByText("Coins Added!")).toBeTruthy();
    });
  });

  describe("Animation", () => {
    it("should not throw when visibility changes trigger animation updates", () => {
      const { rerender } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      expect(() => {
        rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);
      }).not.toThrow();

      expect(() => {
        rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />);
      }).not.toThrow();
    });

    it("should handle rapid visibility toggles without crashing", () => {
      const { rerender } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />
      );

      for (let i = 0; i < 10; i++) {
        expect(() => {
          rerender(
            <CoinPurchaseFanfareModal
              {...defaultProps}
              isVisible={i % 2 === 0}
            />
          );
        }).not.toThrow();
      }
    });

    it("should start animation when modal becomes visible", () => {
      const Animated = require("react-native/Libraries/Animated/Animated");

      const { rerender } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      // Clear any calls from initial render
      Animated.loop.mockClear();
      Animated.timing.mockClear();

      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);

      // Animation should be started when modal becomes visible
      expect(Animated.loop).toHaveBeenCalled();
      expect(Animated.timing).toHaveBeenCalled();
    });

    it("should configure animation with correct timing parameters", () => {
      const Animated = require("react-native/Libraries/Animated/Animated");

      render(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);

      // Verify timing was called with expected parameters
      expect(Animated.timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        })
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle negative coin amounts (edge case)", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={-50} />
      );

      expect(getByText("+-50 Coins")).toBeTruthy();
    });

    it("should handle decimal coin amounts", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={10.5} />
      );

      expect(getByText("+10.5 Coins")).toBeTruthy();
    });

    it("should handle very large coin amounts", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal
          {...defaultProps}
          coinsPurchased={1000000000}
        />
      );

      expect(getByText("+1000000000 Coins")).toBeTruthy();
    });
  });

  describe("Text Content", () => {
    it("should display the title 'Coins Added!'", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByText("Coins Added!")).toBeTruthy();
    });

    it("should display the button text 'Awesome'", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByText("Awesome")).toBeTruthy();
    });

    it("should format coins with plus sign prefix", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} coinsPurchased={75} />
      );

      expect(getByText("+75 Coins")).toBeTruthy();
    });
  });

  describe("Cleanup", () => {
    it("should clean up animation when unmounted while visible", () => {
      const { unmount } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />
      );

      expect(() => unmount()).not.toThrow();
    });

    it("should clean up animation when unmounted while not visible", () => {
      const { unmount } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      expect(() => unmount()).not.toThrow();
    });

    it("should clean up properly after visibility toggle then unmount", () => {
      const { rerender, unmount } = render(
        <CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />
      );

      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={true} />);
      rerender(<CoinPurchaseFanfareModal {...defaultProps} isVisible={false} />);

      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible text elements", () => {
      const { getByText } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByText("Coins Added!")).toBeTruthy();
      expect(getByText("+100 Coins")).toBeTruthy();
      expect(getByText("Awesome")).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("should render the wide button component", () => {
      const { getByTestId } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByTestId("wide-button")).toBeTruthy();
    });

    it("should render the modal component", () => {
      const { getByTestId } = render(
        <CoinPurchaseFanfareModal {...defaultProps} />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });
  });
});
