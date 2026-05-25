import React from "react";
import {Text} from "react-native";
import {styles, SPACING} from "../../styles";

interface SubtitleProps {
  text: string;
}

const Subtitle = ({text}: SubtitleProps) => (
  <Text className="text-center text-white" style={[styles.subtitle, {marginBottom: SPACING.md, color: "#FFFFFF"}]}>
    {text}
  </Text>
);

export default Subtitle;
