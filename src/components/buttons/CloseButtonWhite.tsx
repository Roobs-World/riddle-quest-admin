import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import CloseIconWhite from "../icons/CloseIconWhite";

interface CloseButtonProps extends TouchableOpacityProps {
  onPress: () => void;
  size?: number;
  className?: string;
}

const CloseButtonWhite = ({
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
      <CloseIconWhite width={size} height={size} />
    </TouchableOpacity>
  );
};

export default CloseButtonWhite;
