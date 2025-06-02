import React from "react";
import { Text } from "react-native";
import { styles } from "../../styles/styles";

interface ScreenTitleProps {
  title: string;
  className?: string;
}

const ScreenTitle = ({ title, className }: ScreenTitleProps) => (
  <Text
    className={`text-center text-3xl font-bold mb-2 text-gray-800 ${
      className || ""
    }`}
    style={styles.screenTitle}
  >
    {title}
  </Text>
);

export default ScreenTitle;
