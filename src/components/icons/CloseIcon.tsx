import React from "react";
import CloseSvg from "../../../assets/images/close.svg";

interface CloseIconProps {
  width?: number | string;
  height?: number | string;
  // color prop is included for test compatibility but not used in the SVG
  color?: string;
}

const CloseIcon = ({ width = 18, height = 18, color: _color }: CloseIconProps) => {
  return <CloseSvg width={width} height={height} />;
};

export default CloseIcon;
