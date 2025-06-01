import React from "react";
import BackspaceSvg from "@images/backspace-key.svg";

interface BackspaceIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
}

const BackspaceIcon = ({
  width = 18,
  height = 18,
  color = "#fcfaf4",
}: BackspaceIconProps) => {
  return <BackspaceSvg width={width} height={height} fill={color} />;
};

export default BackspaceIcon;
