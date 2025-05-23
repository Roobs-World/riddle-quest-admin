import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import ButtonBackground from "@images/button.svg";

interface WideButtonProps {
  onPress: () => void;
  buttonText: string;
  className?: string;
  disabled?: boolean;
}

const WideButton: React.FC<WideButtonProps> = ({
  onPress,
  buttonText,
  className,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      className={`w-full mb-4 rounded-lg ${className}`}
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View className="relative">
        <View className="absolute top-0 left-0 right-0 bottom-0">
          <ButtonBackground width="100%" height="100%" />
        </View>
        <View className="py-4 rounded-lg flex-row items-center justify-center">
          <Text
            className={`text-black text-lg font-semibold text-center`}
            style={{ fontFamily: "PoppinsSemiBold" }}
          >
            {buttonText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default WideButton;
