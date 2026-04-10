import React from "react";
import { Image } from "react-native";
import xLogo from "../../../assets/images/x-logo.png";

interface XIconProps {
  width?: number | string;
  tintColor?: string;
}

const XIcon = ({ width, tintColor }: XIconProps) => {
  const iconSize = typeof width === "string" ? parseInt(width) : width || 24;

  return (
    <Image
      source={xLogo}
      style={{
        width: iconSize,
        height: iconSize,
        resizeMode: "contain",
        ...(tintColor ? { tintColor } : {}),
      }}
    />
  );
};

export default XIcon;

