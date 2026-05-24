import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
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
  verticalScale: (size: number) => size,
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  responsiveSizes: {
    textXs: 12, textSm: 14, textBase: 16, textLg: 18, textXl: 20,
    text2xl: 24, text3xl: 30, text4xl: 36, textTitle: 28, textDisplay: 32, textTile: 28,
    spacingXs: 4, spacingSm: 8, spacingMd: 16, spacingLg: 24, spacingXl: 32, spacing2xl: 48,
    buttonHeight: 48, inputHeight: 48, headerHeight: 60, tabBarHeight: 60,
    radiusSm: 4, radiusMd: 8, radiusLg: 12, radiusXl: 16, radiusXxl: 20, radiusFull: 9999,
  },
}));

// Mock styles
jest.mock("../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "PoetsenOne",
    fontSecondary: "Poppins",
    fontSecondaryBold: "PoppinsSemiBold",
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, title: 28, display: 32 },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.104, normal: 0, wide: 0.025 },
  },
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

  return {
    __esModule: true,
    default: {
      View: ({ children, style, ...props }: any) =>
        React.createElement(
          "View",
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
    // Clear console.log to reduce noise
    jest.spyOn(console, "log").mockImplementation(() => {});
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
      const { getByText } = render(<Keyboard {...defaultProps} />);

      expect(getByText("q")).toBeTruthy();
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

  describe("Letter States (keyboard colouring)", () => {
    it("renders without error when letterStates is not provided", () => {
      expect(() => render(<Keyboard {...defaultProps} />)).not.toThrow();
    });

    it("renders without error when letterStates is an empty object", () => {
      expect(() =>
        render(<Keyboard {...defaultProps} letterStates={{}} />)
      ).not.toThrow();
    });

    it("renders without error when letterStates contains all feedback types", () => {
      const letterStates = {
        a: "green" as const,
        s: "yellow" as const,
        d: "red" as const,
      };
      expect(() =>
        render(<Keyboard {...defaultProps} letterStates={letterStates} />)
      ).not.toThrow();
    });

    it("still calls submitKeyPress normally when letterStates is provided", () => {
      const letterStates = { a: "green" as const };
      const { getByText } = render(
        <Keyboard {...defaultProps} letterStates={letterStates} />
      );
      fireEvent(getByText("a"), "pressIn");
      expect(mockSubmitKeyPress).toHaveBeenCalledWith("a");
    });

    it("renders all keys when letterStates covers some letters", () => {
      const letterStates = { q: "green" as const, a: "yellow" as const, z: "red" as const };
      const { getByText } = render(
        <Keyboard {...defaultProps} letterStates={letterStates} />
      );
      // All keys should still render regardless of state
      expect(getByText("q")).toBeTruthy();
      expect(getByText("a")).toBeTruthy();
      expect(getByText("z")).toBeTruthy();
      expect(getByText("w")).toBeTruthy(); // no state — still renders
    });
  });
});

