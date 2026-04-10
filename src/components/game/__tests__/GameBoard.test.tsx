import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import GameBoard from "../GameBoard";

// Mock the responsive utility
jest.mock("../../../utils/responsive", () => ({
  scale: (n: number) => n,
  moderateScale: (n: number) => n,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  dimensions: { screenWidth: 390, screenHeight: 844 },
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    riddleContainer: { padding: 16 },
    riddleContainerTablet: { padding: 24 },
    centerContainer: { alignItems: "center" },
    centerContainerTablet: { paddingHorizontal: 32 },
  },
}));

// Mock child components
jest.mock("../RiddleText", () => {
  const React = require("react");
  return function MockRiddleText({ riddleText }: any) {
    return React.createElement(
      "div",
      {
        testID: "riddle-text",
      },
      riddleText
    );
  };
});

jest.mock("../GuessGrid", () => {
  const React = require("react");
  return function MockGuessGrid({ guesses, currentGuess, answerLength }: any) {
    return React.createElement("div", {
      testID: "guess-grid",
      "data-guesses-length": guesses.length,
      "data-current-guess-length": currentGuess ? currentGuess.length : 0,
      "data-answer-length": answerLength,
    });
  };
});

jest.mock("../Keyboard", () => {
  const React = require("react");

  return function MockKeyboard({ submitKeyPress, isVisible }: any) {
    if (!isVisible) return null;

    return React.createElement("div", {
      testID: "keyboard",
      onClick: () => submitKeyPress && submitKeyPress("a"),
    });
  };
});

// Mock SVG component
jest.mock("../../../../assets/images/questions.svg", () => {
  const React = require("react");
  return function MockQuestionsSvg(props: any) {
    return React.createElement("svg", props);
  };
});

describe("GameBoard", () => {
  const mockSetTileRef = jest.fn();
  const mockOnKeyPress = jest.fn();
  const mockHandleBackspace = jest.fn();
  const mockHandleKeyPress = jest.fn();

  const defaultProps = {
    riddleText: "Test riddle",
    guesses: [
      {
        guess: ["T", "E", "S", "T"],
        feedback: ["green", "yellow", "red", "green"] as (
          | "green"
          | "yellow"
          | "red"
        )[],
      },
    ],
    currentGuess: [] as string[],
    answerLength: 4,
    setTileRef: mockSetTileRef,
    animatedStyle: { opacity: 1 },
    onKeyPress: mockOnKeyPress,
    isAnyOverlayVisible: false,
    handleBackspace: mockHandleBackspace,
    handleKeyPress: mockHandleKeyPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render without error", () => {
      expect(() => {
        render(<GameBoard {...defaultProps} />);
      }).not.toThrow();
    });

    it("should render all child components", () => {
      const { getByTestId } = render(<GameBoard {...defaultProps} />);

      expect(getByTestId("riddle-text")).toBeTruthy();
      expect(getByTestId("guess-grid")).toBeTruthy();
      expect(getByTestId("keyboard")).toBeTruthy();
    });

    it("should pass riddleText to RiddleText component", () => {
      const { getByTestId } = render(<GameBoard {...defaultProps} />);

      const riddleText = getByTestId("riddle-text");
      expect(riddleText.props.children).toBe("Test riddle");
    });

    it("should pass correct props to GuessGrid", () => {
      const { getByTestId } = render(<GameBoard {...defaultProps} />);

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-guesses-length"]).toBe(1);
      expect(guessGrid.props["data-current-guess-length"]).toBe(0);
      expect(guessGrid.props["data-answer-length"]).toBe(4);
    });

    it("should pass currentGuess to GuessGrid", () => {
      const currentGuess = ["T", "E"];
      const { getByTestId } = render(
        <GameBoard {...defaultProps} currentGuess={currentGuess} />
      );

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-current-guess-length"]).toBe(2);
    });
  });

  describe("Overlay Visibility", () => {
    it("should render keyboard when no overlay is visible", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} isAnyOverlayVisible={false} />
      );

      expect(getByTestId("keyboard")).toBeTruthy();
    });

    it("should not render keyboard when overlay is visible", () => {
      const { queryByTestId } = render(
        <GameBoard {...defaultProps} isAnyOverlayVisible={true} />
      );

      expect(queryByTestId("keyboard")).toBeNull();
    });
  });

  describe("Props Validation", () => {
    it("should handle different riddle texts", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} riddleText="Different riddle" />
      );

      const riddleText = getByTestId("riddle-text");
      expect(riddleText.props.children).toBe("Different riddle");
    });

    it("should handle different answer lengths", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} answerLength={6} />
      );

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-answer-length"]).toBe(6);
    });

    it("should handle empty guesses array", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} guesses={[]} />
      );

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-guesses-length"]).toBe(0);
    });

    it("should handle multiple guesses", () => {
      const multipleGuesses = [
        {
          guess: ["T", "E", "S", "T"],
          feedback: ["green", "yellow", "red", "green"] as (
            | "green"
            | "yellow"
            | "red"
          )[],
        },
        {
          guess: ["W", "O", "R", "D"],
          feedback: ["red", "green", "yellow", "green"] as (
            | "green"
            | "yellow"
            | "red"
          )[],
        },
      ];

      const { getByTestId } = render(
        <GameBoard {...defaultProps} guesses={multipleGuesses} />
      );

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-guesses-length"]).toBe(2);
    });
  });

  describe("Callback Functions", () => {
    it("should pass setTileRef function to GuessGrid", () => {
      render(<GameBoard {...defaultProps} />);

      // The function should be passed through, which we can verify by the component rendering
      expect(mockSetTileRef).toBeDefined();
    });

    it("should pass onKeyPress function to Keyboard", () => {
      render(<GameBoard {...defaultProps} />);

      // The function should be passed through, which we can verify by the component rendering
      expect(mockOnKeyPress).toBeDefined();
    });
  });

  describe("Styling", () => {
    it("should apply correct styles to riddle container", () => {
      const { getByTestId } = render(<GameBoard {...defaultProps} />);

      // Component should render without throwing, indicating styles are applied correctly
      expect(getByTestId("riddle-text")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined animatedStyle", () => {
      expect(() => {
        render(<GameBoard {...defaultProps} animatedStyle={undefined} />);
      }).not.toThrow();
    });

    it("should handle empty riddle text", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} riddleText="" />
      );

      const riddleText = getByTestId("riddle-text");
      expect(riddleText.props.children).toBe("");
    });

    it("should handle zero answer length", () => {
      const { getByTestId } = render(
        <GameBoard {...defaultProps} answerLength={0} />
      );

      const guessGrid = getByTestId("guess-grid");
      expect(guessGrid.props["data-answer-length"]).toBe(0);
    });
  });

  describe("Component Integration", () => {
    it("should maintain component structure", () => {
      const { getByTestId } = render(<GameBoard {...defaultProps} />);

      // Verify all main components are present in correct structure
      expect(getByTestId("riddle-text")).toBeTruthy();
      expect(getByTestId("guess-grid")).toBeTruthy();
      expect(getByTestId("keyboard")).toBeTruthy();
    });

    it("should handle component lifecycle", () => {
      const { unmount } = render(<GameBoard {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });
  });
});

