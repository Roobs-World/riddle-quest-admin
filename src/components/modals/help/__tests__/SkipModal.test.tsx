const React = require("react");
import { render, fireEvent } from "@testing-library/react-native";
import SkipModal from "../SkipModal";

// Mock child components
jest.mock("../../../buttons/CloseButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return function MockCloseButton({ onPress }: { onPress: () => void }) {
    return (
      <TouchableOpacity testID="close-button" onPress={onPress}>
        <Text>Close</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("src/components/buttons/WideButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return function MockWideButton({
    buttonText,
    onPress,
    disabled,
  }: {
    buttonText: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <TouchableOpacity
        testID={`wide-button-${buttonText.toLowerCase().replace(/\s+/g, "-")}`}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
});

// Mock SVG
jest.mock("../../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");

describe("<SkipModal />", () => {
  const defaultProps = {
    isVisible: true,
    userCoins: 100,
    skipCost: 50,
    onSkipLevel: jest.fn(),
    onOpenShop: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing when visible", () => {
      expect(() => render(<SkipModal {...defaultProps} />)).not.toThrow();
    });

    it("should render without crashing when not visible", () => {
      expect(() =>
        render(<SkipModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();
    });

    it("should render title text", () => {
      const { getByText } = render(<SkipModal {...defaultProps} />);
      expect(getByText("Skip the level?")).toBeTruthy();
    });

    it("should render cost information", () => {
      const { getByText } = render(<SkipModal {...defaultProps} />);
      expect(getByText("Cost: 50 Coins. You have: 100 Coins.")).toBeTruthy();
    });

    it("should render SKIP LEVEL button", () => {
      const { getByText } = render(<SkipModal {...defaultProps} />);
      expect(getByText("SKIP LEVEL")).toBeTruthy();
    });

    it("should render CLOSE button", () => {
      const { getByTestId } = render(<SkipModal {...defaultProps} />);
      expect(getByTestId("wide-button-close")).toBeTruthy();
    });

    it("should render close button in header", () => {
      const { getByTestId } = render(<SkipModal {...defaultProps} />);
      expect(getByTestId("close-button")).toBeTruthy();
    });
  });

  describe("Affordability Logic", () => {
    it("should not show insufficient funds message when user can afford skip", () => {
      const { queryByText } = render(
        <SkipModal {...defaultProps} userCoins={100} skipCost={50} />
      );
      expect(queryByText("You do not have enough coins to skip a level.")).toBeNull();
    });

    it("should show insufficient funds message when user cannot afford skip", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} userCoins={30} skipCost={50} />
      );
      expect(getByText("You do not have enough coins to skip a level.")).toBeTruthy();
    });

    it("should allow skip when user has exact amount of coins", () => {
      const { queryByText, getByTestId } = render(
        <SkipModal {...defaultProps} userCoins={50} skipCost={50} />
      );
      expect(queryByText("You do not have enough coins to skip a level.")).toBeNull();
      const skipButton = getByTestId("wide-button-skip-level");
      expect(skipButton.props.accessibilityState?.disabled).toBeFalsy();
    });

    it("should show buy coins button when user cannot afford", () => {
      const { getByTestId } = render(
        <SkipModal {...defaultProps} userCoins={10} skipCost={50} />
      );
      expect(getByTestId("wide-button-buy-coins")).toBeTruthy();
    });

    it("should enable skip button when user can afford", () => {
      const { getByTestId } = render(
        <SkipModal {...defaultProps} userCoins={100} skipCost={50} />
      );
      const skipButton = getByTestId("wide-button-skip-level");
      expect(skipButton.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("Interactions", () => {
    it("should call onClose and onSkipLevel when SKIP LEVEL button is pressed", () => {
      const onSkipLevel = jest.fn();
      const onClose = jest.fn();
      const { getByTestId } = render(
        <SkipModal
          {...defaultProps}
          onSkipLevel={onSkipLevel}
          onClose={onClose}
          userCoins={100}
          skipCost={50}
        />
      );

      fireEvent.press(getByTestId("wide-button-skip-level"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSkipLevel).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when CLOSE button is pressed", () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <SkipModal {...defaultProps} onClose={onClose} />
      );

      fireEvent.press(getByTestId("wide-button-close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when header close button is pressed", () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <SkipModal {...defaultProps} onClose={onClose} />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should open shop instead of skipping when user cannot afford", () => {
      const onSkipLevel = jest.fn();
      const onOpenShop = jest.fn();
      const onClose = jest.fn();
      const { getByTestId } = render(
        <SkipModal
          {...defaultProps}
          onSkipLevel={onSkipLevel}
          onOpenShop={onOpenShop}
          onClose={onClose}
          userCoins={10}
          skipCost={50}
        />
      );

      fireEvent.press(getByTestId("wide-button-buy-coins"));
      expect(onSkipLevel).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpenShop).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dynamic Content", () => {
    it("should display different coin amounts", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} userCoins={250} skipCost={75} />
      );
      expect(getByText("Cost: 75 Coins. You have: 250 Coins.")).toBeTruthy();
    });

    it("should display zero coins correctly", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} userCoins={0} skipCost={100} />
      );
      expect(getByText("Cost: 100 Coins. You have: 0 Coins.")).toBeTruthy();
    });
  });

  describe("Visibility Behavior", () => {
    it("should render when visible", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} isVisible={true} />
      );
      expect(getByText("Skip the level?")).toBeTruthy();
    });

    it("should handle invisible state", () => {
      expect(() =>
        render(<SkipModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();
    });
  });

  describe("Component Lifecycle", () => {
    it("should render with different userCoins values", () => {
      expect(() => render(<SkipModal {...defaultProps} userCoins={200} />)).not.toThrow();
      expect(() => render(<SkipModal {...defaultProps} userCoins={0} />)).not.toThrow();
    });

    it("should render with different skipCost values", () => {
      expect(() => render(<SkipModal {...defaultProps} skipCost={100} />)).not.toThrow();
      expect(() => render(<SkipModal {...defaultProps} skipCost={0} />)).not.toThrow();
    });

    it("should handle unmount correctly", () => {
      const { unmount } = render(<SkipModal {...defaultProps} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero coins scenario", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} userCoins={0} skipCost={50} />
      );
      expect(getByText("Cost: 50 Coins. You have: 0 Coins.")).toBeTruthy();
      expect(getByText("You do not have enough coins to skip a level.")).toBeTruthy();
    });

    it("should handle zero skip cost scenario", () => {
      const { getByText, queryByText } = render(
        <SkipModal {...defaultProps} userCoins={0} skipCost={0} />
      );
      expect(getByText("Cost: 0 Coins. You have: 0 Coins.")).toBeTruthy();
      // User can afford skip when cost is 0
      expect(queryByText("You do not have enough coins to skip a level.")).toBeNull();
    });

    it("should handle large coin amounts", () => {
      const { getByText } = render(
        <SkipModal {...defaultProps} userCoins={999999} skipCost={1000} />
      );
      expect(getByText("Cost: 1000 Coins. You have: 999999 Coins.")).toBeTruthy();
    });

    it("should handle coin amount exactly one less than skip cost", () => {
      const { getByText, getByTestId } = render(
        <SkipModal {...defaultProps} userCoins={49} skipCost={50} />
      );
      expect(getByText("You do not have enough coins to skip a level.")).toBeTruthy();
      expect(getByTestId("wide-button-buy-coins")).toBeTruthy();
    });

    it("should handle coin amount exactly one more than skip cost", () => {
      const { queryByText, getByTestId } = render(
        <SkipModal {...defaultProps} userCoins={51} skipCost={50} />
      );
      expect(queryByText("You do not have enough coins to skip a level.")).toBeNull();
      const skipButton = getByTestId("wide-button-skip-level");
      expect(skipButton.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("Order of Callback Execution", () => {
    it("should call onClose before onSkipLevel", () => {
      const callOrder: string[] = [];
      const onClose = jest.fn(() => callOrder.push("close"));
      const onSkipLevel = jest.fn(() => callOrder.push("skip"));

      const { getByTestId } = render(
        <SkipModal
          {...defaultProps}
          onClose={onClose}
          onSkipLevel={onSkipLevel}
          userCoins={100}
          skipCost={50}
        />
      );

      fireEvent.press(getByTestId("wide-button-skip-level"));
      expect(callOrder).toEqual(["close", "skip"]);
    });
  });
});
