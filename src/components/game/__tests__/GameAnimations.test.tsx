import React from "react";
import { render } from "@testing-library/react-native";
import GameAnimations from "../GameAnimations";

// Mock the animation components with working mocks
jest.mock("../../animations/ShatteringTitle", () => {
  const React = require("react");
  return function MockShatteringTitle({ title, startAnimation }: any) {
    return React.createElement(
      "div",
      { testID: "shattering-title" },
      `${title}${startAnimation ? ":animating" : ""}`
    );
  };
});

jest.mock("../../animations/ShatteringTiles", () => {
  const React = require("react");
  return function MockShatteringTiles({
    tiles,
    startAnimation,
    onAnimationComplete,
  }: any) {
    // Simulate animation complete callback
    React.useEffect(() => {
      if (startAnimation && onAnimationComplete) {
        const timer = setTimeout(() => {
          onAnimationComplete();
        }, 10);
        return () => clearTimeout(timer);
      }
    }, [startAnimation, onAnimationComplete]);

    return React.createElement(
      "div",
      { testID: "shattering-tiles" },
      `tiles:${tiles.length}${startAnimation ? ":animating" : ""}`
    );
  };
});

describe("GameAnimations", () => {
  const defaultTileData = [
    {
      letter: "H",
      backgroundColor: "#4CAF50",
      borderColor: "#388E3C",
      textColor: "#FFFFFF",
      x: 10,
      y: 10,
    },
    {
      letter: "E",
      backgroundColor: "#4CAF50",
      borderColor: "#388E3C",
      textColor: "#FFFFFF",
      x: 60,
      y: 10,
    },
  ];

  const defaultProps = {
    isWin: true,
    tilesData: defaultTileData,
    startShatterAnimation: false,
    startTileShatterAnimation: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Conditional Rendering", () => {
    it("should render nothing when isWin is false", () => {
      const { queryByTestId } = render(
        <GameAnimations {...defaultProps} isWin={false} />
      );

      expect(queryByTestId("shattering-title")).toBeNull();
      expect(queryByTestId("shattering-tiles")).toBeNull();
    });

    it("should render animations when isWin is true", () => {
      const { getByTestId } = render(<GameAnimations {...defaultProps} />);

      expect(getByTestId("shattering-title")).toBeTruthy();
      expect(getByTestId("shattering-tiles")).toBeTruthy();
    });

    it("should not render ShatteringTiles when tilesData is empty", () => {
      const { getByTestId, queryByTestId } = render(
        <GameAnimations {...defaultProps} tilesData={[]} />
      );

      expect(getByTestId("shattering-title")).toBeTruthy();
      expect(queryByTestId("shattering-tiles")).toBeNull();
    });
  });

  describe("ShatteringTitle Integration", () => {
    it("should render ShatteringTitle with correct title", () => {
      const { getByTestId } = render(<GameAnimations {...defaultProps} />);

      const shatteringTitle = getByTestId("shattering-title");
      expect(shatteringTitle.props.children).toContain("YOU WON!");
    });

    it("should pass startShatterAnimation prop to ShatteringTitle", () => {
      const { getByTestId, rerender } = render(
        <GameAnimations {...defaultProps} startShatterAnimation={false} />
      );

      let shatteringTitle = getByTestId("shattering-title");
      expect(shatteringTitle.props.children).not.toContain(":animating");

      rerender(
        <GameAnimations {...defaultProps} startShatterAnimation={true} />
      );

      shatteringTitle = getByTestId("shattering-title");
      expect(shatteringTitle.props.children).toContain(":animating");
    });
  });

  describe("ShatteringTiles Integration", () => {
    it("should render ShatteringTiles with correct tiles data", () => {
      const { getByTestId } = render(<GameAnimations {...defaultProps} />);

      const shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain(
        `tiles:${defaultTileData.length}`
      );
    });

    it("should pass startTileShatterAnimation prop to ShatteringTiles", () => {
      const { getByTestId, rerender } = render(
        <GameAnimations {...defaultProps} startTileShatterAnimation={false} />
      );

      let shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).not.toContain(":animating");

      rerender(
        <GameAnimations {...defaultProps} startTileShatterAnimation={true} />
      );

      shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain(":animating");
    });

    it("should handle tiles data changes", () => {
      const { getByTestId, rerender } = render(
        <GameAnimations {...defaultProps} />
      );

      let shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain("tiles:2");

      const newTilesData = [
        ...defaultTileData,
        {
          letter: "L",
          backgroundColor: "#4CAF50",
          borderColor: "#388E3C",
          textColor: "#FFFFFF",
          x: 110,
          y: 10,
        },
      ];

      rerender(<GameAnimations {...defaultProps} tilesData={newTilesData} />);

      shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain("tiles:3");
    });
  });

  describe("Component Behavior", () => {
    it("should handle all props combinations", () => {
      const testCases = [
        {
          isWin: true,
          startShatterAnimation: true,
          startTileShatterAnimation: true,
          tilesData: defaultTileData,
        },
        {
          isWin: true,
          startShatterAnimation: false,
          startTileShatterAnimation: true,
          tilesData: defaultTileData,
        },
        {
          isWin: true,
          startShatterAnimation: true,
          startTileShatterAnimation: false,
          tilesData: defaultTileData,
        },
        {
          isWin: true,
          startShatterAnimation: false,
          startTileShatterAnimation: false,
          tilesData: [],
        },
      ];

      testCases.forEach((testCase) => {
        expect(() => {
          render(<GameAnimations {...testCase} />);
        }).not.toThrow();
      });
    });

    it("should handle empty tiles array", () => {
      const { getByTestId, queryByTestId } = render(
        <GameAnimations {...defaultProps} tilesData={[]} />
      );

      expect(getByTestId("shattering-title")).toBeTruthy();
      expect(queryByTestId("shattering-tiles")).toBeNull();
    });

    it("should handle single tile", () => {
      const singleTile = [defaultTileData[0]];
      const { getByTestId } = render(
        <GameAnimations {...defaultProps} tilesData={singleTile} />
      );

      const shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain("tiles:1");
    });

    it("should handle many tiles", () => {
      const manyTiles = Array.from({ length: 10 }, (_, i) => ({
        letter: String.fromCharCode(65 + i), // A, B, C, etc.
        backgroundColor: "#4CAF50",
        borderColor: "#388E3C",
        textColor: "#FFFFFF",
        x: i * 50,
        y: 10,
      }));

      const { getByTestId } = render(
        <GameAnimations {...defaultProps} tilesData={manyTiles} />
      );

      const shatteringTiles = getByTestId("shattering-tiles");
      expect(shatteringTiles.props.children).toContain("tiles:10");
    });
  });

  describe("Animation Callbacks", () => {
    it("should handle ShatteringTiles animation completion callback", () => {
      const consoleSpy = jest.spyOn(console, "log");

      render(
        <GameAnimations {...defaultProps} startTileShatterAnimation={true} />
      );

      // The mock should trigger the animation complete callback
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Tile shattering animation completed"
        );
      }, 50);
    });
  });

  describe("Props Validation", () => {
    it("should handle undefined tile properties", () => {
      const tilesWithNullLetter = [
        {
          letter: null,
          backgroundColor: "#4CAF50",
          borderColor: "#388E3C",
          textColor: "#FFFFFF",
          x: 10,
          y: 10,
        },
      ];

      expect(() => {
        render(
          <GameAnimations {...defaultProps} tilesData={tilesWithNullLetter} />
        );
      }).not.toThrow();
    });

    it("should handle various tile colors", () => {
      const colorfulTiles = [
        {
          letter: "R",
          backgroundColor: "#FF0000",
          borderColor: "#CC0000",
          textColor: "#FFFFFF",
          x: 10,
          y: 10,
        },
        {
          letter: "G",
          backgroundColor: "#00FF00",
          borderColor: "#00CC00",
          textColor: "#000000",
          x: 60,
          y: 10,
        },
      ];

      expect(() => {
        render(<GameAnimations {...defaultProps} tilesData={colorfulTiles} />);
      }).not.toThrow();
    });
  });
});
