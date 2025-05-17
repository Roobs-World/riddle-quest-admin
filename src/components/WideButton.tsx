import React from "react";
import { TouchableOpacity, Text } from "react-native";

interface WideButtonProps {
  onPress: () => void;
  buttonText: string;
}

const WideButton: React.FC<WideButtonProps> = ({ onPress, buttonText }) => {
  return (
    <TouchableOpacity
      className="bg-[#FCC070] w-full py-4 rounded-lg shadow-md mb-4"
      onPress={onPress}
    >
      <Text className="text-white text-lg font-semibold text-center">
        {buttonText}
      </Text>
    </TouchableOpacity>
  );
};

export default WideButton;
