import React from "react";
import { Text, StyleSheet } from "react-native";

interface ScreenTitleProps {
  title: string;
  className?: string;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({ title, className }) => {
  return (
    <Text
      className={`text-2xl font-semibold w-full text-gray-800 text-center ${className}`}
      style={styles.title}
    >
      {title}
    </Text>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: "PoppinsSemiBold",
  },
});

export default ScreenTitle;
