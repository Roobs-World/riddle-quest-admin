import React from "react";
import CloseSvg from "@images/close.svg";

interface CloseIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
}

const CloseIcon = ({
  width = 18,
  height = 18,
  color = "black",
}: CloseIconProps) => {
  return <CloseSvg width={width} height={height} fill={color} />;
};

export default CloseIcon;
