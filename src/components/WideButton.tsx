import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import ButtonBackground from "@images/button.svg";

interface WideButtonProps {
  onPress: () => void;
  buttonText: string;
}

const WideButton: React.FC<WideButtonProps> = ({ onPress, buttonText }) => {
  return (
    <TouchableOpacity className="w-full mb-4 rounded-lg" onPress={onPress}>
      <View className="relative">
        {/* SVG Background */}
        <View className="absolute top-0 left-0 right-0 bottom-0">
          <ButtonBackground width="100%" height="100%" />
        </View>
        {/* Button Text */}
        <View className="py-4 rounded-lg">
          <Text
            className="text-black text-lg font-semibold text-center"
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
