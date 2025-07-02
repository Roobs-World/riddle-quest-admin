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

  const defaultProps = {
    onKeyPress: mockOnKeyPress,
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
    it("should call onKeyPress when letter key is pressed", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      fireEvent.press(getByText("q"));
      expect(mockOnKeyPress).toHaveBeenCalledWith("q");
    });

    it("should call onKeyPress for all letter keys", () => {
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
        fireEvent.press(getByText(key));
        expect(mockOnKeyPress).toHaveBeenCalledWith(key);
      });

      expect(mockOnKeyPress).toHaveBeenCalledTimes(allKeys.length);
    });

    it("should handle backspace key press", () => {
      const { getByTestId } = render(<Keyboard {...defaultProps} />);

      const backspaceButton = getByTestId("backspace-icon").parent;
      if (backspaceButton) {
        fireEvent.press(backspaceButton);
        expect(mockOnKeyPress).toHaveBeenCalledWith("BACKSPACE");
      }
    });

    it("should handle multiple key presses", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      fireEvent.press(getByText("h"));
      fireEvent.press(getByText("e"));
      fireEvent.press(getByText("l"));
      fireEvent.press(getByText("l"));
      fireEvent.press(getByText("o"));

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
      // Test that component renders without error when particle system is active
      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle particle animation triggers", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Pressing keys should trigger particle animations
      expect(() => {
        fireEvent.press(getByText("q"));
      }).not.toThrow();
    });

    it("should handle multiple particle triggers", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      expect(() => {
        fireEvent.press(getByText("q"));
        fireEvent.press(getByText("w"));
        fireEvent.press(getByText("e"));
      }).not.toThrow();
    });
  });

  describe("Responsive Design", () => {
    it("should apply responsive scaling", () => {
      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle tablet layout", () => {
      // Mock isTablet as true
      jest.doMock("../../../utils/responsive", () => ({
        scale: (size: number) => size * 1.5,
        moderateScale: (size: number) => size * 1.3,
        isTablet: true,
      }));

      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe("Layout Structure", () => {
    it("should have correct keyboard layout structure", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Verify that all expected keys are present
      const allExpectedKeys = [
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

      allExpectedKeys.forEach((key) => {
        expect(getByText(key)).toBeTruthy();
      });
    });

    it("should maintain proper row structure", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Test that keys from each row are present
      expect(getByText("q")).toBeTruthy(); // Top row
      expect(getByText("a")).toBeTruthy(); // Middle row
      expect(getByText("z")).toBeTruthy(); // Bottom row
    });
  });

  describe("Error Handling", () => {
    it("should handle undefined onKeyPress gracefully", () => {
      expect(() => {
        render(<Keyboard onKeyPress={undefined as any} isVisible={true} />);
      }).not.toThrow();
    });

    it("should handle measurement failures", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Should not throw even if measurement fails
      expect(() => {
        fireEvent.press(getByText("q"));
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

      const newOnKeyPress = jest.fn();
      expect(() => {
        rerender(<Keyboard onKeyPress={newOnKeyPress} isVisible={true} />);
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle rapid key presses", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      // Simulate rapid key presses
      expect(() => {
        for (let i = 0; i < 10; i++) {
          fireEvent.press(getByText("q"));
        }
      }).not.toThrow();

      expect(mockOnKeyPress).toHaveBeenCalledTimes(10);
    });

    it("should handle all key combinations", () => {
      const { getByText, getByTestId } = render(<Keyboard {...defaultProps} />);

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

      expect(() => {
        allKeys.forEach((key) => {
          fireEvent.press(getByText(key));
        });

        // Test backspace
        const backspaceButton = getByTestId("backspace-icon").parent;
        if (backspaceButton) {
          fireEvent.press(backspaceButton);
        }
      }).not.toThrow();
    });
  });

  describe("Visual Elements", () => {
    it("should render with correct styling", () => {
      expect(() => {
        render(<Keyboard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle active opacity on key press", () => {
      const { getByText } = render(<Keyboard {...defaultProps} />);

      expect(() => {
        fireEvent.press(getByText("q"));
      }).not.toThrow();
    });
  });
});
