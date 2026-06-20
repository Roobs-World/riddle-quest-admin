import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import InstructionsModal from "../InstructionsModal";

// Mock the CloseButton component
jest.mock("../../../buttons/CloseButton", () => {
  const React = require("react");
  const {TouchableOpacity, Text} = require("react-native");

  const MockCloseButton = ({onPress, size}: any) => (
    <TouchableOpacity testID="close-button" onPress={onPress}>
      <Text>Close {size}</Text>
    </TouchableOpacity>
  );

  MockCloseButton.displayName = "MockCloseButton";
  return MockCloseButton;
});

// Mock SVG component
jest.mock("../../../../assets/images/home-bg.svg", () => "HomeBgSvg");

describe("InstructionsModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Rendering", () => {
    it("renders correctly when visible", () => {
      const {getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      expect(getByText("How to Play")).toBeTruthy();
    });

    it("renders as a Modal component", () => {
      const {UNSAFE_getByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const Modal = require("react-native").Modal;
      expect(UNSAFE_getByType(Modal)).toBeTruthy();
    });

    it("displays the close button", () => {
      const {getByTestId} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      expect(getByTestId("close-button")).toBeTruthy();
    });

    it("renders onboarding progress when provided", () => {
      const {getByText, getByTestId} = render(
        <InstructionsModal isVisible={true} onClose={mockOnClose} onboardingProgress={{current: 3, total: 3}} />,
      );

      expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
      expect(getByText("3/3")).toBeTruthy();
    });
  });

  describe("Visibility", () => {
    it("shows modal when isVisible is true", () => {
      const {UNSAFE_getByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.visible).toBe(true);
    });

    it("hides modal when isVisible is false", () => {
      const {UNSAFE_getByType} = render(<InstructionsModal isVisible={false} onClose={mockOnClose} />);
      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.visible).toBe(false);
    });
  });

  describe("Modal Properties", () => {
    it("sets correct modal properties", () => {
      const {UNSAFE_getByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.transparent).toBe(true);
      expect(modal.props.animationType).toBe("none");
      expect(typeof modal.props.onRequestClose).toBe("function");
    });
  });

  describe("Interaction", () => {
    it("calls onClose when close button is pressed", () => {
      const {getByTestId} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Got It! button is pressed", () => {
      const {getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      fireEvent.press(getByText("Got It!"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("handles onRequestClose correctly", () => {
      const {UNSAFE_getByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);

      // Simulate onRequestClose
      modal.props.onRequestClose();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

  });

  describe("Content Structure", () => {
    it("renders instruction steps", () => {
      const {getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      expect(getByText("The Goal")).toBeTruthy();
      expect(getByText("Guess the hidden riddle in 5 tries using the color clues to guide you.")).toBeTruthy();
      expect(getByText("Color Clues")).toBeTruthy();
    });

    it("renders color explanations", () => {
      const {getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      expect(getByText("Letter is correct and in the right position")).toBeTruthy();
      expect(getByText("Letter is in the word but wrong position")).toBeTruthy();
      expect(getByText("Letter is not in the word at all")).toBeTruthy();
    });

    it("renders action button", () => {
      const {getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      expect(getByText("Got It!")).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("has correct View hierarchy", () => {
      const {UNSAFE_getAllByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      expect(views.length).toBeGreaterThan(0);
    });

    it("contains TouchableOpacity components", () => {
      const {UNSAFE_getAllByType} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      expect(touchables.length).toBeGreaterThan(0);
    });
  });

  describe("Props Validation", () => {
    it("works with all required props", () => {
      expect(() => {
        render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);
      }).not.toThrow();
    });

    it("works with isVisible false", () => {
      expect(() => {
        render(<InstructionsModal isVisible={false} onClose={mockOnClose} />);
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("provides accessible close options", () => {
      const {getByTestId, getByText} = render(<InstructionsModal isVisible={true} onClose={mockOnClose} />);

      const closeButton = getByTestId("close-button");
      const gotItButton = getByText("Got It!");

      expect(closeButton).toBeTruthy();
      expect(gotItButton).toBeTruthy();
    });
  });
});
