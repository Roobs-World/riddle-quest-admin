import React from "react";
import CloseSvg from "@images/close.svg";

interface CloseIconProps {
  width?: number | string;
  height?: number | string;
}

const CloseIcon = ({ width = 18, height = 18 }: CloseIconProps) => {
  return <CloseSvg width={width} height={height} />;
};

export default CloseIcon;
