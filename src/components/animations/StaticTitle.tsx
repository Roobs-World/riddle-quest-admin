import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../styles/tokens/colors";
import { scale } from "../../utils/responsive";

interface StaticTitleProps {
  title: string;
}

const StaticTitle: React.FC<StaticTitleProps> = ({ title }) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  title: {
    color: COLORS.primaryOrange,
    fontSize: scale(32),
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  titleContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 10,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
});

export default StaticTitle;
