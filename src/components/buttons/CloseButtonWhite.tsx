import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import CloseIconWhite from "../icons/CloseIconWhite";
import { SPACING } from "../../styles";
import { CLOSE_BUTTON_SIZE_LG } from "../../constants/layout";

interface CloseButtonProps extends TouchableOpacityProps {
  onPress: () => void;
  size?: number;
  className?: string;
}

const CloseButtonWhite = ({
  onPress,
  size = CLOSE_BUTTON_SIZE_LG,
  className = "",
  ...props
}: CloseButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={className}
      style={{ padding: SPACING.sm }}
      accessibilityLabel="Close"
      accessibilityRole="button"
      {...props}
    >
      <CloseIconWhite width={size} height={size} />
    </TouchableOpacity>
  );
};

export default CloseButtonWhite;
