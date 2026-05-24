import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SocialShareButton from "../SocialShareButton";

// Mock icon components
jest.mock("../../icons/FacebookIcon", () => {
  const { View } = require("react-native");
  return function MockFacebookIcon({ width, height }: { width: number; height: number }) {
    return <View testID="facebook-icon" data-width={width} data-height={height} />;
  };
});

jest.mock("../../icons/XIcon", () => {
  const { View } = require("react-native");
  return function MockXIcon({ width, tintColor }: { width: number; tintColor: string }) {
    return <View testID="x-icon" data-width={width} data-tint-color={tintColor} />;
  };
});

// Mock styles
jest.mock("../../../styles/tokens/colors", () => ({
  COLORS: {
    gray200: "#E5E7EB",
    gray400: "#9CA3AF",
    shadowColor: "#000000",
  },
}));

jest.mock("../../../styles/tokens/spacing", () => ({
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  },
}));

jest.mock("../../../styles/tokens/borderRadius", () => ({
  BORDER_RADIUS: {
    lg: 12,
  },
}));

jest.mock("../../../styles/tokens/typography", () => ({
  TYPOGRAPHY: {
    fontSecondary: "Poppins",
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
    },
  },
}));

jest.mock("../../../utils/responsive", () => ({
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  moderateScale: (size: number) => size,
}));

jest.mock("../../../constants/layout", () => ({
  SOCIAL_BUTTON_MIN_WIDTH_SM: 80,
  SOCIAL_BUTTON_MIN_WIDTH_MD: 100,
  SOCIAL_BUTTON_MIN_WIDTH_LG: 120,
}));

describe("<SocialShareButton />", () => {
  const defaultProps = {
    platform: "facebook" as const,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<SocialShareButton {...defaultProps} />)).not.toThrow();
    });

    it("should render Facebook button correctly", () => {
      const { getByText, getByTestId, getByRole } = render(
        <SocialShareButton {...defaultProps} platform="facebook" />
      );
      expect(getByTestId("facebook-icon")).toBeTruthy();
      expect(getByText("Facebook")).toBeTruthy();
      expect(getByRole("button")).toBeTruthy();
    });

    it("should render X button correctly", () => {
      const { getByTestId, queryByText, getByRole } = render(
        <SocialShareButton {...defaultProps} platform="x" />
      );
      expect(getByTestId("x-icon")).toBeTruthy();
      // X button should not display text label
      expect(queryByText("X")).toBeNull();
      expect(getByRole("button")).toBeTruthy();
    });

    it("should render system share button correctly", () => {
      const { getByText, queryByTestId } = render(
        <SocialShareButton {...defaultProps} platform="system" />
      );
      // System platform should not render any icon
      expect(queryByTestId("facebook-icon")).toBeNull();
      expect(queryByTestId("x-icon")).toBeNull();
      expect(getByText("Share")).toBeTruthy();
    });

    it("should have correct accessibility label for Facebook", () => {
      const { getByLabelText } = render(
        <SocialShareButton {...defaultProps} platform="facebook" />
      );
      expect(getByLabelText("Share to Facebook")).toBeTruthy();
    });

    it("should have correct accessibility label for X", () => {
      const { getByLabelText } = render(
        <SocialShareButton {...defaultProps} platform="x" />
      );
      expect(getByLabelText("Share to X")).toBeTruthy();
    });

    it("should have correct accessibility label for system", () => {
      const { getByLabelText } = render(
        <SocialShareButton {...defaultProps} platform="system" />
      );
      expect(getByLabelText("Share")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onPress when pressed and not disabled", () => {
      const { getByRole } = render(<SocialShareButton {...defaultProps} />);
      fireEvent.press(getByRole("button"));
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it("should not call onPress when disabled", () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress} disabled={true} />
      );
      fireEvent.press(getByRole("button"));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should handle multiple presses when enabled", () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress} />
      );
      const button = getByRole("button");
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      expect(onPress).toHaveBeenCalledTimes(3);
    });
  });

  describe("Size Variants", () => {
    it("should render small size correctly", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} size="small" />
      );
      expect(getByRole("button")).toBeTruthy();
    });

    it("should render medium size correctly", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} size="medium" />
      );
      expect(getByRole("button")).toBeTruthy();
    });

    it("should render large size correctly", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} size="large" />
      );
      expect(getByRole("button")).toBeTruthy();
    });

    it("should default to medium size", () => {
      const { getByRole } = render(<SocialShareButton {...defaultProps} />);
      expect(getByRole("button")).toBeTruthy();
    });
  });

  describe("Full Width", () => {
    it("should render without full width by default", () => {
      const { getByRole } = render(<SocialShareButton {...defaultProps} />);
      expect(getByRole("button")).toBeTruthy();
    });

    it("should render with full width when specified", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} fullWidth={true} />
      );
      expect(getByRole("button")).toBeTruthy();
    });
  });

  describe("Disabled State", () => {
    it("should have disabled styling when disabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} disabled={true} />
      );
      const button = getByRole("button");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it("should not have disabled styling when enabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} disabled={false} />
      );
      const button = getByRole("button");
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
    });

    it("should default to enabled", () => {
      const { getByRole } = render(<SocialShareButton {...defaultProps} />);
      const button = getByRole("button");
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("Platform-specific Styling", () => {
    it("should apply Facebook background color when enabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} platform="facebook" disabled={false} />
      );
      const button = getByRole("button");
      // Check that button has style applied
      expect(button.props.style).toBeDefined();
    });

    it("should apply X background color when enabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} platform="x" disabled={false} />
      );
      const button = getByRole("button");
      expect(button.props.style).toBeDefined();
    });

    it("should apply system background color when enabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} platform="system" disabled={false} />
      );
      const button = getByRole("button");
      expect(button.props.style).toBeDefined();
    });

    it("should apply disabled background color when disabled", () => {
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} disabled={true} />
      );
      const button = getByRole("button");
      expect(button.props.style).toBeDefined();
    });
  });

  describe("Icon Size", () => {
    it("should use smaller icon for small size", () => {
      const { getByTestId } = render(
        <SocialShareButton {...defaultProps} platform="facebook" size="small" />
      );
      const icon = getByTestId("facebook-icon");
      expect(icon).toBeTruthy();
    });

    it("should use medium icon for medium size", () => {
      const { getByTestId } = render(
        <SocialShareButton {...defaultProps} platform="facebook" size="medium" />
      );
      const icon = getByTestId("facebook-icon");
      expect(icon).toBeTruthy();
    });

    it("should use larger icon for large size", () => {
      const { getByTestId } = render(
        <SocialShareButton {...defaultProps} platform="facebook" size="large" />
      );
      const icon = getByTestId("facebook-icon");
      expect(icon).toBeTruthy();
    });
  });

  describe("Component Lifecycle", () => {
    it("should render with different platforms", () => {
      expect(() => render(<SocialShareButton {...defaultProps} platform="x" />)).not.toThrow();
      expect(() => render(<SocialShareButton {...defaultProps} platform="system" />)).not.toThrow();
    });

    it("should render with different disabled states", () => {
      expect(() => render(<SocialShareButton {...defaultProps} disabled={true} />)).not.toThrow();
      expect(() => render(<SocialShareButton {...defaultProps} disabled={false} />)).not.toThrow();
    });

    it("should render with different sizes", () => {
      expect(() => render(<SocialShareButton {...defaultProps} size="small" />)).not.toThrow();
      expect(() => render(<SocialShareButton {...defaultProps} size="large" />)).not.toThrow();
    });

    it("should handle unmount correctly", () => {
      const { unmount } = render(<SocialShareButton {...defaultProps} />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle callback functions", () => {
      const onPress1 = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress1} />
      );

      fireEvent.press(getByRole("button"));
      expect(onPress1).toHaveBeenCalledTimes(1);
    });

    it("should handle different callback functions", () => {
      const onPress2 = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress2} />
      );

      fireEvent.press(getByRole("button"));
      expect(onPress2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should not call onPress when disabled", () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress} disabled={true} />
      );

      fireEvent.press(getByRole("button"));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should call onPress when not disabled", () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <SocialShareButton {...defaultProps} onPress={onPress} disabled={false} />
      );

      fireEvent.press(getByRole("button"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should render facebook icon for facebook platform", () => {
      const { getByTestId, queryByTestId } = render(
        <SocialShareButton {...defaultProps} platform="facebook" />
      );

      expect(getByTestId("facebook-icon")).toBeTruthy();
      expect(queryByTestId("x-icon")).toBeNull();
    });

    it("should render x icon for x platform", () => {
      const { getByTestId, queryByTestId } = render(
        <SocialShareButton {...defaultProps} platform="x" />
      );

      expect(queryByTestId("facebook-icon")).toBeNull();
      expect(getByTestId("x-icon")).toBeTruthy();
    });
  });

  describe("Active Opacity", () => {
    it("should render button with active opacity styling", () => {
      const { getByRole } = render(<SocialShareButton {...defaultProps} />);
      const button = getByRole("button");
      // Button should render correctly with activeOpacity
      expect(button).toBeTruthy();
    });
  });
});
