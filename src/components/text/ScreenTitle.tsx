import React from "react";
import { Text } from "react-native";

interface ScreenTitleProps {
  title: string;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({ title }) => {
  return (
    <Text
      className="text-2xl font-semibold text-gray-800 mb-8 text-left w-full"
      style={{ fontFamily: "PoppinsSemiBold" }}
    >
      {title}
    </Text>
  );
};

export default ScreenTitle;
