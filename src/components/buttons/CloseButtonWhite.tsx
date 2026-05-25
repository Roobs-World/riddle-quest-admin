import React from "react";
import {TouchableOpacityProps} from "react-native";
import CloseButton from "./CloseButton";

interface CloseButtonProps extends TouchableOpacityProps {
  onPress: () => void;
  size?: number;
  className?: string;
}

const CloseButtonWhite = ({onPress, size, className = "", ...props}: CloseButtonProps) => {
  return <CloseButton onPress={onPress} className={className} size={size} color="white" {...props} />;
};

export default CloseButtonWhite;
