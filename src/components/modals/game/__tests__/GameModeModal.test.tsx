import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import GameModeModal from "../GameModeModal";

// Mock Modal to avoid native module errors
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({
      children,
      visible,
      onRequestClose,
      animationType,
      transparent,
    }: any) {
      if (!visible) return null;
      return React.createElement(
        "View",
        {
          testID: "modal",
          onRequestClose,
          "data-animation-type": animationType,
          "data-transparent": transparent,
        },
        children
      );
    },
  };
});

// Mock the CloseButton component
jest.mock("../../../buttons/CloseButton", () => {
  const React = require("react");
  return function MockCloseButton({ onPress, size, style }: any) {
    return React.createElement(
      "View",
      {
        testID: "close-button",
        accessible: true,
        onPress,
        "data-size": size,
      },
      React.createElement("Text", null, "Close")
    );
  };
});

// Mock the SVG component
jest.mock("../../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  return function MockModalBg({ width, height, style }: any) {
    return React.createElement("View", {
      testID: "modal-bg",
      "data-width": width,
      "data-height": height,
    });
  };
});

// Mock styles
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSize: { sm: 14, lg: 18, xl: 24 },
  },
  SPACING: { md: 16, xl: 32 },
}));

// Mock layout constants
jest.mock("../../../../constants/layout", () => ({
  MODAL_WIDTH: 300,
  MODAL_HEIGHT: 400,
  CLOSE_BUTTON_SIZE: 24,
  MODAL_CLOSE_BUTTON_POSITION: { position: "absolute", top: 10, right: 10 },
}));

describe("GameModeModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSelectMode = jest.fn();

  const defaultProps = {
    isVisible: true,
    onClose: mockOnClose,
    onSelectMode: mockOnSelectMode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText, getByTestId } = render(
        <GameModeModal {...defaultProps} />
      );

      expect(getByTestId("modal")).toBeTruthy();
      expect(getByText("LET'S PLAY")).toBeTruthy();
      expect(getByText("Classic")).toBeTruthy();
      expect(getByText("Daily Challenge")).toBeTruthy();
      expect(getByTestId("close-button")).toBeTruthy();
    });

    it("should not render when not visible", () => {
      const { queryByTestId, queryByText } = render(
        <GameModeModal {...defaultProps} isVisible={false} />
      );

      expect(queryByTestId("modal")).toBeNull();
      expect(queryByText("LET'S PLAY")).toBeNull();
    });

    it("should render modal background SVG", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      expect(getByTestId("modal-bg")).toBeTruthy();
    });

    it("should render title with correct text", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      expect(getByText("LET'S PLAY")).toBeTruthy();
    });
  });

  describe("Game Mode Buttons", () => {
    it("should render Classic button", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      expect(getByText("Classic")).toBeTruthy();
    });

    it("should render Daily Challenge button", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      expect(getByText("Daily Challenge")).toBeTruthy();
    });

    it("should call onSelectMode with classic when Classic is pressed", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      const classicButton = getByText("Classic");
      fireEvent.press(classicButton);

      expect(mockOnSelectMode).toHaveBeenCalledWith("classic");
      expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
    });

    it("should call onSelectMode with daily when Daily Challenge is pressed", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      const dailyButton = getByText("Daily Challenge");
      fireEvent.press(dailyButton);

      expect(mockOnSelectMode).toHaveBeenCalledWith("daily");
      expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
    });
  });

  describe("Current Level Display", () => {
    it("should display current level when provided", () => {
      const { getByText } = render(
        <GameModeModal {...defaultProps} currentLevel={5} />
      );

      expect(getByText("Level 5")).toBeTruthy();
    });

    it("should display level 1 when currentLevel is 1", () => {
      const { getByText } = render(
        <GameModeModal {...defaultProps} currentLevel={1} />
      );

      expect(getByText("Level 1")).toBeTruthy();
    });

    it("should display high level numbers", () => {
      const { getByText } = render(
        <GameModeModal {...defaultProps} currentLevel={100} />
      );

      expect(getByText("Level 100")).toBeTruthy();
    });

    it("should not display level when currentLevel is not provided", () => {
      const { queryByText } = render(<GameModeModal {...defaultProps} />);

      expect(queryByText(/Level/)).toBeNull();
    });

    it("should not display level when currentLevel is undefined", () => {
      const { queryByText } = render(
        <GameModeModal {...defaultProps} currentLevel={undefined} />
      );

      expect(queryByText(/Level/)).toBeNull();
    });

    it("should display level 0 when currentLevel is 0", () => {
      const { queryByText } = render(
        <GameModeModal {...defaultProps} currentLevel={0} />
      );

      // currentLevel != null evaluates to true for 0, so it should not show
      // Actually checking the condition: 0 != null is true, so Level 0 would show
      expect(queryByText("Level 0")).toBeTruthy();
    });
  });

  describe("Close Button Interactions", () => {
    it("should call onClose when close button is pressed", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should pass correct size to close button", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      expect(closeButton.props["data-size"]).toBe(24);
    });
  });

  describe("Modal Configuration", () => {
    it("should render with fade animation type", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const modal = getByTestId("modal");
      expect(modal.props["data-animation-type"]).toBe("fade");
    });

    it("should render with transparent background", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const modal = getByTestId("modal");
      expect(modal.props["data-transparent"]).toBe(true);
    });
  });

  describe("Visibility Behavior", () => {
    it("should handle visibility toggle", () => {
      const { rerender, queryByTestId } = render(
        <GameModeModal {...defaultProps} isVisible={true} />
      );

      expect(queryByTestId("modal")).toBeTruthy();

      rerender(<GameModeModal {...defaultProps} isVisible={false} />);

      expect(queryByTestId("modal")).toBeNull();

      rerender(<GameModeModal {...defaultProps} isVisible={true} />);

      expect(queryByTestId("modal")).toBeTruthy();
    });

    it("should handle rapid visibility changes", () => {
      const { rerender, queryByTestId } = render(
        <GameModeModal {...defaultProps} isVisible={true} />
      );

      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(<GameModeModal {...defaultProps} isVisible={i % 2 === 0} />);
        }).not.toThrow();
      }
    });
  });

  describe("Dynamic Props", () => {
    it("should update currentLevel when prop changes", () => {
      const { rerender, getByText, queryByText } = render(
        <GameModeModal {...defaultProps} currentLevel={1} />
      );

      expect(getByText("Level 1")).toBeTruthy();

      rerender(<GameModeModal {...defaultProps} currentLevel={10} />);

      expect(queryByText("Level 1")).toBeNull();
      expect(getByText("Level 10")).toBeTruthy();
    });

    it("should handle removing currentLevel prop", () => {
      const { rerender, getByText, queryByText } = render(
        <GameModeModal {...defaultProps} currentLevel={5} />
      );

      expect(getByText("Level 5")).toBeTruthy();

      rerender(<GameModeModal {...defaultProps} currentLevel={undefined} />);

      expect(queryByText("Level 5")).toBeNull();
      expect(queryByText(/Level/)).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should render without crashing with minimal props", () => {
      expect(() => {
        render(<GameModeModal {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle onClose being called multiple times", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      fireEvent.press(closeButton);
      fireEvent.press(closeButton);
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });

    it("should handle onSelectMode being called multiple times", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      const classicButton = getByText("Classic");
      fireEvent.press(classicButton);
      fireEvent.press(classicButton);

      expect(mockOnSelectMode).toHaveBeenCalledTimes(2);
      expect(mockOnSelectMode).toHaveBeenCalledWith("classic");
    });

    it("should handle alternating game mode selections", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      const classicButton = getByText("Classic");
      const dailyButton = getByText("Daily Challenge");

      fireEvent.press(classicButton);
      fireEvent.press(dailyButton);
      fireEvent.press(classicButton);

      expect(mockOnSelectMode).toHaveBeenCalledTimes(3);
      expect(mockOnSelectMode).toHaveBeenNthCalledWith(1, "classic");
      expect(mockOnSelectMode).toHaveBeenNthCalledWith(2, "daily");
      expect(mockOnSelectMode).toHaveBeenNthCalledWith(3, "classic");
    });

    it("should handle very large level numbers", () => {
      const { getByText } = render(
        <GameModeModal {...defaultProps} currentLevel={999999} />
      );

      expect(getByText("Level 999999")).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("should be a React component", () => {
      expect(GameModeModal).toBeDefined();
      expect(typeof GameModeModal).toBe("function");
    });

    it("should render with correct modal structure", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const modal = getByTestId("modal");
      expect(modal).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible game mode buttons", () => {
      const { getByText } = render(<GameModeModal {...defaultProps} />);

      expect(getByText("Classic")).toBeTruthy();
      expect(getByText("Daily Challenge")).toBeTruthy();
    });

    it("should have accessible close button", () => {
      const { getByTestId } = render(<GameModeModal {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      expect(closeButton.props.accessible).toBe(true);
    });
  });

  describe("Button Interactions", () => {
    it("should handle Classic button press correctly", () => {
      const customOnSelectMode = jest.fn();
      const { getByText } = render(
        <GameModeModal {...defaultProps} onSelectMode={customOnSelectMode} />
      );

      fireEvent.press(getByText("Classic"));

      expect(customOnSelectMode).toHaveBeenCalledWith("classic");
    });

    it("should handle Daily Challenge button press correctly", () => {
      const customOnSelectMode = jest.fn();
      const { getByText } = render(
        <GameModeModal {...defaultProps} onSelectMode={customOnSelectMode} />
      );

      fireEvent.press(getByText("Daily Challenge"));

      expect(customOnSelectMode).toHaveBeenCalledWith("daily");
    });
  });
});
