import React from "react";
import BackspaceSvg from "@images/backspace-key.svg";

interface BackspaceIconProps {
  color?: string;
}

const width = 32;
const height = 32;

const BackspaceIcon = ({ color = "#fcfaf4" }: BackspaceIconProps) => {
  return <BackspaceSvg width={width} height={height} fill={color} />;
};

export default BackspaceIcon;
