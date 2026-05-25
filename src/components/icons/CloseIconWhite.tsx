import React from "react";
import CloseSvg from "@images/close-white.svg";

interface CloseIconProps {
  width?: number | string;
  height?: number | string;
}

const CloseIconWhite = ({width = 18, height = 18}: CloseIconProps) => {
  return <CloseSvg width={width} height={height} />;
};

export default CloseIconWhite;
