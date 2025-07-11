import React from "react";
import FacebookSvg from "../../../assets/images/facebook.svg";

interface FacebookIconProps {
  width?: number | string;
  height?: number | string;
}

const FacebookIcon = ({ width, height }: FacebookIconProps) => {
  return <FacebookSvg width={width} height={height} />;
};

export default FacebookIcon;
