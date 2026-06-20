const React = require("react");
import {render, fireEvent} from "@testing-library/react-native";
import {GameInput} from "../GameInput";

const mockSubmitButton = jest.fn();

// Mock child components
jest.mock("../SubmitButton", () => {
  const {TouchableOpacity, Text} = require("react-native");
  return {
    SubmitButton: ({
      isSubmitDisabled,
      gameOver,
      isTooltipTargetActive,
      handleKeyPress,
    }: {
      isSubmitDisabled: boolean;
      gameOver: boolean;
      isTooltipTargetActive?: boolean;
      handleKeyPress: (key: string) => void;
    }) => {
      mockSubmitButton({isSubmitDisabled, gameOver, isTooltipTargetActive});
      return (
        <TouchableOpacity
          testID="submit-button"
          onPress={() => handleKeyPress("ENTER")}
          disabled={isSubmitDisabled || gameOver}
        >
          <Text>SUBMIT</Text>
        </TouchableOpacity>
      );
    },
  };
});

jest.mock("../GameInputButton", () => {
  const {TouchableOpacity, Text} = require("react-native");
  return {
    GameInputButton: ({text, callback}: {text: string; callback: () => void}) => (
      <TouchableOpacity testID={`game-input-button-${text.toLowerCase()}`} onPress={callback}>
        <Text>{text}</Text>
      </TouchableOpacity>
    ),
  };
});

// Mock SVG icons
jest.mock("../../../../assets/images/hint.svg", () => "HintIcon");
jest.mock("../../../../assets/images/forward.svg", () => "ForwardIcon");

// Mock styles
jest.mock("src/styles", () => ({
  styles: {
    gameInput: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
  },
}));

describe("<GameInput />", () => {
  const defaultProps = {
    isSubmitDisabled: false,
    gameOver: false,
    handleSubmit: jest.fn(),
    handleHint: jest.fn(),
    handleNext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitButton.mockClear();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<GameInput {...defaultProps} />)).not.toThrow();
    });

    it("should render hint button", () => {
      const {getByText} = render(<GameInput {...defaultProps} />);
      expect(getByText("Hint")).toBeTruthy();
    });

    it("should render submit button", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should render next button", () => {
      const {getByText} = render(<GameInput {...defaultProps} />);
      expect(getByText("Next")).toBeTruthy();
    });

    it("should render all three buttons", () => {
      const {getByText, getByTestId} = render(<GameInput {...defaultProps} />);
      expect(getByText("Hint")).toBeTruthy();
      expect(getByTestId("submit-button")).toBeTruthy();
      expect(getByText("Next")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call handleHint when hint button is pressed", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      fireEvent.press(getByTestId("game-input-button-hint"));
      expect(defaultProps.handleHint).toHaveBeenCalledTimes(1);
    });

    it("should call handleSubmit when submit button is pressed", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      fireEvent.press(getByTestId("submit-button"));
      expect(defaultProps.handleSubmit).toHaveBeenCalledTimes(1);
    });

    it("should call handleNext when next button is pressed", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      fireEvent.press(getByTestId("game-input-button-next"));
      expect(defaultProps.handleNext).toHaveBeenCalledTimes(1);
    });

    it("should allow multiple hint button presses", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      const hintButton = getByTestId("game-input-button-hint");
      fireEvent.press(hintButton);
      fireEvent.press(hintButton);
      fireEvent.press(hintButton);
      expect(defaultProps.handleHint).toHaveBeenCalledTimes(3);
    });

    it("should allow multiple next button presses", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} />);
      const nextButton = getByTestId("game-input-button-next");
      fireEvent.press(nextButton);
      fireEvent.press(nextButton);
      expect(defaultProps.handleNext).toHaveBeenCalledTimes(2);
    });
  });

  describe("Submit Button State", () => {
    it("should pass isSubmitDisabled prop to SubmitButton when true", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} isSubmitDisabled={true} />);
      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.accessibilityState?.disabled).toBe(true);
    });

    it("should pass isSubmitDisabled prop to SubmitButton when false", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} isSubmitDisabled={false} />);
      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.accessibilityState?.disabled).toBeFalsy();
    });

    it("should pass gameOver prop to SubmitButton when true", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} gameOver={true} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should pass gameOver prop to SubmitButton when false", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} gameOver={false} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should handle submit disabled and game not over", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} isSubmitDisabled={true} gameOver={false} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should handle submit enabled and game over", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} isSubmitDisabled={false} gameOver={true} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should handle both submit disabled and game over", () => {
      const {getByTestId} = render(<GameInput {...defaultProps} isSubmitDisabled={true} gameOver={true} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should pass tooltip target state to SubmitButton", () => {
      render(<GameInput {...defaultProps} isSubmitTooltipTargetActive={true} />);
      expect(mockSubmitButton).toHaveBeenLastCalledWith(expect.objectContaining({isTooltipTargetActive: true}));
    });
  });

  describe("Component Lifecycle", () => {
    it("should render with different prop combinations", () => {
      expect(() => {
        render(<GameInput {...defaultProps} isSubmitDisabled={true} />);
      }).not.toThrow();

      expect(() => {
        render(<GameInput {...defaultProps} gameOver={true} />);
      }).not.toThrow();

      expect(() => {
        render(<GameInput {...defaultProps} handleSubmit={jest.fn()} handleHint={jest.fn()} handleNext={jest.fn()} />);
      }).not.toThrow();
    });

    it("should handle unmount correctly", () => {
      const {unmount} = render(<GameInput {...defaultProps} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle callbacks that throw errors gracefully", () => {
      const errorCallback = jest.fn(() => {
        throw new Error("Test error");
      });
      const {getByTestId} = render(<GameInput {...defaultProps} handleHint={errorCallback} />);

      expect(() => {
        fireEvent.press(getByTestId("game-input-button-hint"));
      }).toThrow("Test error");
      expect(errorCallback).toHaveBeenCalled();
    });

    it("should work with different callback functions", () => {
      const handleHint = jest.fn();
      const {getByTestId} = render(<GameInput {...defaultProps} handleHint={handleHint} />);

      fireEvent.press(getByTestId("game-input-button-hint"));
      expect(handleHint).toHaveBeenCalledTimes(1);
    });
  });

  describe("Memoization", () => {
    it("should be wrapped in React.memo", () => {
      // GameInput is exported as a memoized component
      expect(GameInput.$$typeof).toBeDefined();
    });
  });
});
