import React from "react";
import { Image, View } from "react-native";
import xLogo from "../../../assets/images/x-logo.png";

interface XIconProps {
  width?: number | string;
  height?: number | string;
}

const XIcon = ({ width, height }: XIconProps) => {
  return (
    <View
      style={{
        width: typeof width === "string" ? parseInt(width) : width,
        height: typeof height === "string" ? parseInt(height) : height,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={xLogo}
        style={{
          width: "100%",
          height: "100%",
          resizeMode: "contain",
        }}
      />
    </View>
  );
};

export default XIcon;
