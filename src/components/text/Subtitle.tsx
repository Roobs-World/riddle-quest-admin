import React from "react";
import { Text, StyleSheet } from "react-native";

interface SubtitleProps {
  text: string;
}

const Subtitle: React.FC<SubtitleProps> = ({ text }) => {
  return (
    <Text className="text-center text-gray-600 mb-4" style={styles.subtitle}>
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: "Poppins",
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: -0.104,
    lineHeight: 24,
  },
});

export default Subtitle;
