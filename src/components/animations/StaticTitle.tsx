import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../styles/tokens/colors";
import { TYPOGRAPHY } from "../../styles/tokens/typography";
import { BORDER_RADIUS } from "../../styles/tokens/borderRadius";
import { STATIC_TITLE_PADDING_H, STATIC_TITLE_PADDING_V } from "../../constants/layout";
import { moderateScale } from "../../utils/responsive";

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
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.display,
    fontWeight: "400",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: moderateScale(1), height: moderateScale(1) },
    textShadowRadius: moderateScale(2),
  },
  titleContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: STATIC_TITLE_PADDING_H,
    paddingVertical: STATIC_TITLE_PADDING_V,
  },
});

export default StaticTitle;
