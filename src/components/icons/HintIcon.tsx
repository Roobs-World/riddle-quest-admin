import React from "react";
import HintSvg from "@images/hint.svg";

interface HintIconProps {
  width?: number;
  height?: number;
  color?: string;
}

const HintIcon: React.FC<HintIconProps> = ({
  width = 24,
  height = 24,
  color = "#fcfaf4",
}) => {
  return <HintSvg width={width} height={height} fill={color} />;
};

export default HintIcon;
