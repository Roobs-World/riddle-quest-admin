import React from "react";
import { Image, View } from "react-native";
import xLogo from "../../../assets/images/x-logo.png";

interface XIconProps {
  width?: number | string;
  height?: number | string;
}

const XIcon = ({ width, height }: XIconProps) => {
  const iconSize = typeof width === "string" ? parseInt(width) : width;
  const iconHeight = typeof height === "string" ? parseInt(height) : height;

  return (
    <View
      style={{
        width: iconSize,
        height: iconHeight,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Image
        source={xLogo}
        style={{
          width: "100%", // Changed from 90% to 100% for better visibility
          height: "100%", // Changed from 90% to 100%
          resizeMode: "contain",
          alignSelf: "center", // Added to ensure proper centering
        }}
      />
    </View>
  );
};

export default XIcon;
