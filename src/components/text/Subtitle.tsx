import React from "react";
import { Text } from "react-native";
import { styles } from "../../styles";

interface SubtitleProps {
  text: string;
}

const Subtitle = ({ text }: SubtitleProps) => (
  <Text className="text-center text-gray-600 mb-4" style={styles.subtitle}>
    {text}
  </Text>
);

export default Subtitle;
