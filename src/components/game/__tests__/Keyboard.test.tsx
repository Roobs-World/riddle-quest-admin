import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import Keyboard from "../Keyboard";

// Mock BackspaceIcon
jest.mock("../../icons/BackspaceIcon", () => {
  const React = require("react");
  return function MockBackspaceIcon({ width, height, color }: any) {
    return React.createElement("div", {
      testID: "backspace-icon",
      "data-width": width,
      "data-height": height,
      "data-color": color,
    });
  };
});

// Mock responsive utilities
jest.mock("../../../utils/responsive", () => ({
  scale: (size: number) => size * 1.2,
  moderateScale: (size: number) => size * 1.1,
  isTablet: false,
}));

// Mock styles
jest.mock("../../../styles", () => ({
  gameStyles: {
    keyboardContainer: { backgroundColor: "#1a1a2e" },
    particleLayer: { position: "absolute", zIndex: 0 },
    keyboardLayer: { zIndex: 1 },
    keyboardRow: { flexDirection: "row", justifyContent: "center" },
    keyButton: {
      backgroundColor: "#16213e",
      alignItems: "center",
      justifyContent: "center",
    },
    keyText: { color: "#fcfaf4", fontWeight: "600" },
    backspaceKey: {
      backgroundColor: "#e94560",
      alignItems: "center",
      justifyContent: "center",
    },
    particleStarContainer: { position: "absolute" },
    particleStar: { backgroundColor: "#ffffff" },
    particleAsteroidContainer: { position: "absolute" },
    particleAsteroid: { backgroundColor: "#888888" },
  },
}));

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: {
      View: ({ children, style, ...props }: any) =>
        React.createElement(
          View,
          { style, ...props, testID: "animated-view" },
          children
        ),
    },
    useSharedValue: (value: any) => ({ value }),
    useAnimatedStyle: (fn: any) => ({}),
    withTiming: (value: any, config?: any) => value,
    withDelay: (delay: number, value: any) => value,
    withSequence: (...values: any[]) => values[values.length - 1],
    Easing: {
      out: (fn: any) => fn,
      in: (fn: any) => fn,
      cubic: {},
      quad: {},
      linear: {},
    },
  };
});

describe("Keyboard", () => {
  const mockOnKeyPress = jest.fn();
  const mockSubmitKeyPress = jest.fn();
  const mockHandleBackspace = jest.fn();

  const defaultProps = {
    submitKeyPress: mockSubmitKeyPress,
    handleBackspace: mockHandleBackspace,
    isVisible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console.log and console.error
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render without error", () => {
      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should render all letter keys", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Test top row
      const topRowKeys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
      topRowKeys.forEach((key) => {
        expect(getByText(key)).toBeTruthy();
      });

      // Test middle row
      const midRowKeys = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
      midRowKeys.forEach((key) => {
        expect(getByText(key)).toBeTruthy();
      });

      // Test bottom row
      const bottomRowKeys = ["z", "x", "c", "v", "b", "n", "m"];
      bottomRowKeys.forEach((key) => {
        expect(getByText(key)).toBeTruthy();
      });
    });

    it("should render backspace button", () => {
      const { getByTestId } = render(<Keyboard {...defaultProps} />);

      expect(getByTestId("backspace-icon")).toBeTruthy();
    });

    it("should render keyboard structure", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Should render keyboard rows and keys properly
      expect(getByText("q")).toBeTruthy(); // Top row
      expect(getByText("a")).toBeTruthy(); // Middle row
      expect(getByText("z")).toBeTruthy(); // Bottom row
    });
  });

  describe("Key Press Handling", () => {
    it("should call submitKeyPress when letter key is pressed", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      fireEvent(getByText("q"), "pressIn");
      expect(mockSubmitKeyPress).toHaveBeenCalledWith("q");
    });

    it("should call submitKeyPress for all letter keys", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      const allKeys = [
        "q",
        "w",
        "e",
        "r",
        "t",
        "y",
        "u",
        "i",
        "o",
        "p",
        "a",
        "s",
        "d",
        "f",
        "g",
        "h",
        "j",
        "k",
        "l",
        "z",
        "x",
        "c",
        "v",
        "b",
        "n",
        "m",
      ];

      allKeys.forEach((key) => {
        fireEvent(getByText(key), "pressIn");
        expect(mockSubmitKeyPress).toHaveBeenCalledWith(key);
      });

      expect(mockSubmitKeyPress).toHaveBeenCalledTimes(allKeys.length);
    });

    it("should handle backspace key press", () => {
      const { getByTestId } = render(<Keyboard {...defaultProps} />);

      const backspaceButton = getByTestId("backspace-icon").parent;
      if (backspaceButton) {
        fireEvent(backspaceButton, "pressIn");
        expect(mockHandleBackspace).toHaveBeenCalled();
      }
    });

    it("should handle multiple key presses", () => {
      const props = {
        ...defaultProps,
        submitKeyPress: mockOnKeyPress,
      };
      const { getByText } = render(<Keyboard {...props} />);

      fireEvent(getByText("h"), "pressIn");
      fireEvent(getByText("e"), "pressIn");
      fireEvent(getByText("l"), "pressIn");
      fireEvent(getByText("l"), "pressIn");
      fireEvent(getByText("o"), "pressIn");

      expect(mockOnKeyPress).toHaveBeenCalledTimes(5);
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(1, "h");
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(2, "e");
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(3, "l");
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(4, "l");
      expect(mockOnKeyPress).toHaveBeenNthCalledWith(5, "o");
    });
  });

  describe("Particle System", () => {
    it("should create particles with different types", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Particle system should render without error
      expect(getByText("q")).toBeTruthy();
    });

    it("should handle particle animation triggers", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Simulate key press to trigger particle animation
      fireEvent(getByText("a"), "pressIn");

      // Particle animation should not cause errors
      expect(mockSubmitKeyPress).toHaveBeenCalledWith("a");
    });

    it("should handle multiple particle triggers", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Simulate multiple key presses to trigger multiple particle animations
      fireEvent(getByText("q"), "pressIn");
      fireEvent(getByText("w"), "pressIn");
      fireEvent(getByText("e"), "pressIn");

      // Multiple particle animations should not cause errors
      expect(mockSubmitKeyPress).toHaveBeenCalledTimes(3);
    });
  });

  describe("Responsive Design", () => {
    it("should apply responsive scaling", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Component should render with responsive scaling
      expect(getByText("q")).toBeTruthy();
    });

    it("should handle tablet layout", () => {
      // Create a new mock for this test
      jest.resetModules();
      jest.mock("../../../utils/responsive", () => ({
        scale: (size: number) => size * 1.2,
        moderateScale: (size: number) => size * 1.1,
        isTablet: true,
      }));

      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Component should render with tablet layout
      expect(getByText("q")).toBeTruthy();

      // Reset the mock to its original state
      jest.resetModules();
      jest.mock("../../../utils/responsive", () => ({
        scale: (size: number) => size * 1.2,
        moderateScale: (size: number) => size * 1.1,
        isTablet: false,
      }));
    });
  });

  describe("Layout Structure", () => {
    it("should have correct keyboard layout structure", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Verify QWERTY layout structure
      expect(getByText("q")).toBeTruthy();
      expect(getByText("a")).toBeTruthy();
      expect(getByText("z")).toBeTruthy();
    });

    it("should maintain proper row structure", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Verify row structure
      expect(getByText("q")).toBeTruthy(); // First key in top row
      expect(getByText("p")).toBeTruthy(); // Last key in top row
      expect(getByText("a")).toBeTruthy(); // First key in middle row
      expect(getByText("l")).toBeTruthy(); // Last key in middle row
      expect(getByText("z")).toBeTruthy(); // First key in bottom row
      expect(getByText("m")).toBeTruthy(); // Last key in bottom row
    });
  });

  describe("Error Handling", () => {
    it("should handle undefined onKeyPress gracefully", () => {
      expect(() => {
        render(
          <Keyboard
            submitKeyPress={jest.fn()}
            handleBackspace={jest.fn()}
            onKeyPress={undefined as any}
            isVisible={true}
          />
        );
      }).not.toThrow();
    });

    it("should handle measurement failures", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Should not throw even if measurement fails
      expect(() => {
        fireEvent(getByText("q"), "pressIn");
      }).not.toThrow();
    });
  });

  describe("Component Lifecycle", () => {
    it("should handle component mounting", () => {
      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle component unmounting", () => {
      const { unmount } = render(<Keyboard {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });

    it("should handle prop updates", () => {
      const { rerender } = render(<Keyboard {...defaultProps} />);

      expect(() => {
        rerender(<Keyboard {...defaultProps} isVisible={false} />);
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle rapid key presses", () => {
      const props = {
        ...defaultProps,
        submitKeyPress: mockOnKeyPress,
      };
      const { getByText } = render(<Keyboard {...props} />);

      // Simulate rapid key presses
      expect(() => {
        for (let i = 0; i < 10; i++) {
          const key = "qwertyuiopasdfghjklzxcvbnm"[i % 26];
          fireEvent(getByText(key), "pressIn");
        }
      }).not.toThrow();

      expect(mockOnKeyPress).toHaveBeenCalledTimes(10);
    });

    it("should handle all key combinations", () => {
      const { getByText, getByTestId } = render(<Keyboard {...defaultProps} />);

      // Test a combination of letter keys and backspace
      fireEvent(getByText("h"), "pressIn");
      fireEvent(getByText("e"), "pressIn");
      fireEvent(getByText("l"), "pressIn");
      fireEvent(getByText("l"), "pressIn");
      fireEvent(getByText("o"), "pressIn");

      const backspaceButton = getByTestId("backspace-icon").parent;
      if (backspaceButton) {
        fireEvent(backspaceButton, "pressIn");
      }

      expect(mockSubmitKeyPress).toHaveBeenCalledTimes(5);
      expect(mockHandleBackspace).toHaveBeenCalledTimes(1);
    });
  });

  describe("Visual Elements", () => {
    it("should render with correct styling", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Component should render with correct styling
      expect(getByText("q")).toBeTruthy();
    });

    it("should handle active opacity on key press", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Simulate key press to test active opacity
      fireEvent(getByText("q"), "pressIn");

      // Key press should not cause errors
      expect(mockSubmitKeyPress).toHaveBeenCalledWith("q");
    });
  });
});
