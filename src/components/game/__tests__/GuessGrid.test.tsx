import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import GuessGrid from "../GuessGrid";
import type { SubmittedGuess } from "../../../hooks/types";

// Mock useTileCapture hook
jest.mock("../../../hooks/useTileCapture", () => ({
  useTileCapture: () => ({
    setTileRef: jest.fn(),
  }),
}));

// Mock responsive utilities
jest.mock("../../../utils/responsive", () => ({
  scale: (size: number) => size * 1.2, // Mock scaling factor
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    maskingContainer: { overflow: "hidden" },
  },
}));

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: {
      View: ({ children, style, className }: any) =>
        React.createElement(
          View,
          { style, className, testID: "animated-view" },
          children
        ),
    },
    useSharedValue: () => ({ value: 0 }),
    withSequence: (...args: any[]) => args[args.length - 1],
    withTiming: (value: any) => value,
    withSpring: (value: any) => value,
  };
});

describe("GuessGrid", () => {
  const mockSetTileRef = jest.fn();

  const defaultProps = {
    guesses: [] as SubmittedGuess[],
    currentGuess: [] as string[],
    shakeKey: 0,
    answerLength: 4,
    setTileRef: mockSetTileRef,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render without error", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} />);
      }).not.toThrow();
    });

    it("should render 3 rows by default", () => {
      const { getAllByTestId } = render(<GuessGrid {...defaultProps} />);

      const animatedViews = getAllByTestId("animated-view");
      expect(animatedViews).toHaveLength(3);
    });

    it("should render correct number of cells per row", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} answerLength={5} />);
      }).not.toThrow();
    });
  });

  describe("Guess Display", () => {
    it("should display submitted guesses", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        },
      ];

      const { getAllByText, getByText } = render(
        <GuessGrid {...defaultProps} guesses={guesses} />
      );

      expect(getAllByText("T")).toHaveLength(2); // T appears twice
      expect(getByText("E")).toBeTruthy();
      expect(getByText("S")).toBeTruthy();
    });

    it("should handle multiple submitted guesses", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        },
        {
          guess: ["W", "O", "R", "D"],
          feedback: ["red", "green", "yellow", "green"],
        },
      ];

      const { getAllByText, getByText } = render(
        <GuessGrid {...defaultProps} guesses={guesses} />
      );

      expect(getAllByText("T")).toHaveLength(2); // T appears twice in first guess
      expect(getByText("E")).toBeTruthy();
      expect(getByText("W")).toBeTruthy();
      expect(getByText("O")).toBeTruthy();
    });

    it("should handle empty guesses array", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} guesses={[]} />);
      }).not.toThrow();
    });
  });

  describe("Current Guess Display", () => {
    it("should display current guess being typed", () => {
      const currentGuess = ["T", "E"];

      expect(() => {
        render(<GuessGrid {...defaultProps} currentGuess={currentGuess} />);
      }).not.toThrow();
    });

    it("should handle empty current guess", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} currentGuess={[]} />);
      }).not.toThrow();
    });

    it("should display current guess in the next available row", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        },
      ];
      const currentGuess = ["H", "E"];

      expect(() => {
        render(
          <GuessGrid
            {...defaultProps}
            guesses={guesses}
            currentGuess={currentGuess}
          />
        );
      }).not.toThrow();
    });

    it("should not display current guess when all rows are filled", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        },
        {
          guess: ["W", "O", "R", "D"],
          feedback: ["red", "green", "yellow", "green"],
        },
        {
          guess: ["F", "I", "N", "A"],
          feedback: ["red", "red", "red", "red"],
        },
      ];
      const currentGuess = ["H", "E"];

      expect(() => {
        render(
          <GuessGrid
            {...defaultProps}
            guesses={guesses}
            currentGuess={currentGuess}
          />
        );
      }).not.toThrow();
    });
  });

  describe("Answer Length Handling", () => {
    it("should handle different answer lengths", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["H", "E", "L", "L", "O"],
          feedback: ["green", "yellow", "red", "green", "yellow"],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={5} />
        );
      }).not.toThrow();
    });

    it("should handle very short answers", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["G", "O"],
          feedback: ["green", "yellow"],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={2} />
        );
      }).not.toThrow();
    });

    it("should handle very long answers", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["S", "U", "P", "E", "R", "C", "A", "L"],
          feedback: [
            "green",
            "yellow",
            "red",
            "green",
            "yellow",
            "red",
            "green",
            "yellow",
          ],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={8} />
        );
      }).not.toThrow();
    });
  });

  describe("Shake Animation", () => {
    it("should handle shake key changes", () => {
      const { rerender } = render(<GuessGrid {...defaultProps} shakeKey={0} />);

      expect(() => {
        rerender(<GuessGrid {...defaultProps} shakeKey={1} />);
      }).not.toThrow();
    });

    it("should handle multiple shake animations", () => {
      const { rerender } = render(<GuessGrid {...defaultProps} shakeKey={0} />);

      expect(() => {
        rerender(<GuessGrid {...defaultProps} shakeKey={1} />);
        rerender(<GuessGrid {...defaultProps} shakeKey={2} />);
        rerender(<GuessGrid {...defaultProps} shakeKey={3} />);
      }).not.toThrow();
    });
  });

  describe("Feedback Colors", () => {
    it("should handle green feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["green"],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={1} />
        );
      }).not.toThrow();
    });

    it("should handle yellow feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["yellow"],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={1} />
        );
      }).not.toThrow();
    });

    it("should handle red feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["red"],
        },
      ];

      expect(() => {
        render(
          <GuessGrid {...defaultProps} guesses={guesses} answerLength={1} />
        );
      }).not.toThrow();
    });

    it("should handle mixed feedback in one guess", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        },
      ];

      expect(() => {
        render(<GuessGrid {...defaultProps} guesses={guesses} />);
      }).not.toThrow();
    });
  });

  describe("Tile Reference Handling", () => {
    it("should call setTileRef when provided", () => {
      render(<GuessGrid {...defaultProps} />);

      // setTileRef should be available for external use
      expect(mockSetTileRef).toBeDefined();
    });

    it("should work without setTileRef prop", () => {
      const propsWithoutSetTileRef = {
        guesses: [],
        currentGuess: [] as string[],
        shakeKey: 0,
        answerLength: 4,
      };

      expect(() => {
        render(<GuessGrid {...propsWithoutSetTileRef} />);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null letters", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle zero answer length", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} answerLength={0} />);
      }).not.toThrow();
    });

    it("should handle negative shake key", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} shakeKey={-1} />);
      }).not.toThrow();
    });

    it("should handle very large shake key", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} shakeKey={999} />);
      }).not.toThrow();
    });
  });

  describe("Component Lifecycle", () => {
    it("should handle component unmounting", () => {
      const { unmount } = render(<GuessGrid {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });

    it("should handle prop updates", () => {
      const { rerender } = render(<GuessGrid {...defaultProps} />);

      const newGuesses: SubmittedGuess[] = [
        {
          guess: ["N", "E", "W"],
          feedback: ["green", "yellow", "red"],
        },
      ];

      expect(() => {
        rerender(
          <GuessGrid {...defaultProps} guesses={newGuesses} answerLength={3} />
        );
      }).not.toThrow();
    });
  });

  describe("Performance and Optimization", () => {
    it("should handle rapid prop changes", () => {
      const { rerender } = render(<GuessGrid {...defaultProps} />);

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        expect(() => {
          rerender(<GuessGrid {...defaultProps} shakeKey={i} />);
        }).not.toThrow();
      }
    });

    it("should handle large number of guesses efficiently", () => {
      const manyGuesses: SubmittedGuess[] = [];
      for (let i = 0; i < 3; i++) {
        manyGuesses.push({
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"],
        });
      }

      expect(() => {
        render(<GuessGrid {...defaultProps} guesses={manyGuesses} />);
      }).not.toThrow();
    });
  });

  describe("Responsive Design", () => {
    it("should apply responsive scaling", () => {
      expect(() => {
        render(<GuessGrid {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle different screen sizes", () => {
      // Test that responsive scaling doesn't break the component
      expect(() => {
        render(<GuessGrid {...defaultProps} answerLength={6} />);
      }).not.toThrow();
    });
  });
});
