import React from "react";
import CloseSvg from "../../../assets/images/close.svg";

interface CloseIconProps {
  width?: number | string;
  height?: number | string;
  // color prop is included for test compatibility but not used in the SVG
  color?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CloseIcon = ({ width = 18, height = 18, color }: CloseIconProps) => {
  return <CloseSvg width={width} height={height} />;
};

export default CloseIcon;
