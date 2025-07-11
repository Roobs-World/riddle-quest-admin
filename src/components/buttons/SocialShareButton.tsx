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
import { TouchableOpacity, Text, View } from "react-native";
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
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  platform,
  onPress,
  disabled = false,
  size = "medium",
}) => {
  const getIcon = () => {
    const iconSize = size === "small" ? 20 : size === "medium" ? 24 : 32;

    switch (platform) {
      case "facebook":
        return <FacebookIcon width={iconSize} height={iconSize} />;
      case "x":
        return <XIcon width={iconSize} height={iconSize} />;
      default:
        return null;
    }
  };

  const getButtonStyle = () => {
    const baseStyle = {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
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
        backgroundColor: disabled ? COLORS.gray200 : "#000000", // X uses black branding
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...platformStyles[platform],
    };
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontWeight: "bold" as const, // Changed from "600" to "bold" to match modal text patterns
      marginLeft: platform === "x" ? scale(4) : SPACING.xs, // Adjust margin for X platform
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

    // Ensure white text for better visibility, especially on X's black background
    const textColor = disabled ? COLORS.gray400 : "#FFFFFF";

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
        return "X";
      default:
        return "";
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityLabel={`Share to ${getPlatformText()}`}
      accessibilityRole="button"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          // Add specific adjustments for X platform
          ...(platform === "x" && {
            paddingLeft: scale(2), // Slight adjustment for X logo
          }),
        }}
      >
        {getIcon()}
        <Text style={getTextStyle()}>{getPlatformText()}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default SocialShareButton;
