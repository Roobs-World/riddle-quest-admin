import React from "react";
import { Text } from "react-native";

interface ScreenTitleProps {
  title: string;
  className?: string;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({ title, className }) => {
  return (
    <Text
      className={`text-2xl font-semibold w-full text-gray-800 text-center ${className}`}
      style={{ fontFamily: "PoppinsSemiBold" }}
    >
      {title}
    </Text>
  );
};

export default ScreenTitle;
