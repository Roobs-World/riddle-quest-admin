import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import CloseIcon from "../icons/CloseIcon";

interface CloseButtonProps extends TouchableOpacityProps {
  onPress: () => void;
  size?: number;
  className?: string;
}

const CloseButton = ({
  onPress,
  size = 24,
  className = "",
  ...props
}: CloseButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`p-2 ${className}`}
      accessibilityLabel="Close"
      accessibilityRole="button"
      {...props}
    >
      <CloseIcon width={size} height={size} />
    </TouchableOpacity>
  );
};

export default CloseButton;
