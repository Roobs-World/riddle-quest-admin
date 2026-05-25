import React from "react";
import {Image} from "react-native";
import LogoPng from "@images/icon.png";

interface LogoIconProps {
  width?: number;
  height?: number;
}

const LogoIcon: React.FC<LogoIconProps> = ({width = 24, height = 24}) => {
  return (
    <Image source={LogoPng} style={{width, height}} resizeMode="contain" accessibilityIgnoresInvertColors={true} />
  );
};

export default LogoIcon;
