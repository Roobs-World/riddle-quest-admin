/**
 * @fileoverview SocialShareButton - Reusable social media sharing button component.
 *
 * This component provides a consistent design for social media sharing buttons
 * with platform-specific icons and styling. It follows the existing button
 * design patterns established in the app.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ViewStyle,
} from "react-native";
import FacebookIcon from "../icons/FacebookIcon";
import XIcon from "../icons/XIcon";
import { COLORS } from "../../styles/tokens/colors";
import { SPACING } from "../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../styles/tokens/borderRadius";
import { scale } from "../../utils/responsive";

interface SocialShareButtonProps {
  platform: "facebook" | "x";
  onPress: () => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  platform,
  onPress,
  disabled = false,
  size = "medium",
  fullWidth = false,
}) => {
  const getIcon = () => {
    // Standard icon sizes for all platforms
    const iconSize = size === "small" ? 20 : size === "medium" ? 24 : 32;

    switch (platform) {
      case "facebook":
        return <FacebookIcon width={iconSize} height={iconSize} />;
      case "x":
        return <XIcon width={iconSize} />;
      default:
        return null;
    }
  };

  const getButtonStyle = () => {
    const baseStyle: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: COLORS.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    };

    const sizeStyles = {
      small: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        minWidth: scale(80),
      },
      medium: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        minWidth: scale(120),
      },
      large: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        minWidth: scale(160),
      },
    };

    const platformStyles = {
      facebook: {
        backgroundColor: disabled ? COLORS.gray200 : "#1877F2",
      },
      x: {
        backgroundColor: disabled ? COLORS.gray200 : "white", // X uses black branding
      },
    };

    const widthStyle: ViewStyle = fullWidth ? { width: "100%" } : {};

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...platformStyles[platform],
      ...widthStyle,
    };
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontWeight: "bold" as const,
      marginLeft: SPACING.xs,
    };

    const sizeTextStyles = {
      small: {
        fontSize: scale(12),
      },
      medium: {
        fontSize: scale(14),
      },
      large: {
        fontSize: scale(16),
      },
    };

    // Platform-specific text colors
    const textColor = disabled
      ? COLORS.gray400
      : platform === "x"
      ? "#000000"
      : "#FFFFFF";

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      color: textColor,
    };
  };

  const getPlatformText = () => {
    switch (platform) {
      case "facebook":
        return "Facebook";
      case "x":
        return "";
      default:
        return "";
    }
  };

  const platformText = getPlatformText();

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityLabel={`Share to ${platformText || platform}`}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.contentContainer,
          platform === "facebook"
            ? styles.facebookContentContainer
            : styles.xContentContainer,
        ]}
      >
        {getIcon()}
        {platformText ? (
          <Text style={getTextStyle()}>{platformText}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  facebookContentContainer: {
    transform: [{ translateX: -15 }],
  },
  xContentContainer: {
    transform: [{ translateX: 5 }],
  },
});

export default SocialShareButton;
