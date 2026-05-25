import React from "react";
import BackspaceSvg from "../../../assets/images/backspace-key.svg";

interface BackspaceIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BackspaceIcon: React.FC<BackspaceIconProps> = ({width = 32, height = 32, color}) => {
  return <BackspaceSvg width={width} height={height} color={color} />;
};

export default BackspaceIcon;
