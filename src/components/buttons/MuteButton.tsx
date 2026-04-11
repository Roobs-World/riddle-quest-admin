import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { SPACING } from "../../styles";

interface MuteButtonProps extends Omit<TouchableOpacityProps, "onPress"> {
  isMuted: boolean;
  onToggle: () => void;
  iconSize?: number;
  iconColor?: string;
}

const MuteButton = ({
  isMuted,
  onToggle,
  iconSize = 22,
  iconColor = "#FFFFFF",
  style,
  ...props
}: MuteButtonProps) => {
  const iconName = isMuted ? "volume-off" : "volume-high";

  return (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isMuted ? "Unmute sound" : "Mute sound"}
      testID="mute-button"
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.35)",
          padding: SPACING.xs,
        },
        style,
      ]}
      {...props}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={iconSize}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

export default MuteButton;
