import React from "react";
import { Text } from "react-native";

interface ScreenTitleProps {
  title: string;
  className?: string;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({ title, className }) => {
  return (
    <Text
      className={`text-2xl font-semibold text-gray-800 my-8 text-left w-full ${className}`}
      style={{ fontFamily: "PoppinsSemiBold" }}
    >
      {title}
    </Text>
  );
};

export default ScreenTitle;
