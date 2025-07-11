import React from "react";
import { Image, View } from "react-native";
import xLogo from "../../../assets/images/x-logo.png";

interface XIconProps {
  width?: number | string;
}

const XIcon = ({ width }: XIconProps) => {
  const iconSize = typeof width === "string" ? parseInt(width) : width || 24;
  const iconHeight = 24;

  return (
    <View
      style={{
        width: iconSize,
        height: iconHeight,
        position: "relative",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,

          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={xLogo}
          style={{
            width: iconSize * 0.6,
            height: iconHeight * 0.6,
            resizeMode: "contain",
            padding: 18,
          }}
        />
      </View>
    </View>
  );
};

export default XIcon;
