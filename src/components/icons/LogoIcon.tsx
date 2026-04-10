import React from "react";
import LogoSvg from "@images/logo.svg";

interface LogoIconProps {
  width?: number;
  height?: number;
  color?: string;
}

const LogoIcon: React.FC<LogoIconProps> = ({
  width = 24,
  height = 24,
  color = "#fcfaf4",
}) => {
  return <LogoSvg width={width} height={height} fill={color} />;
};

export default LogoIcon;

