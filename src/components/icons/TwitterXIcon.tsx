import React from "react";
import TwitterXSvg from "../../../assets/images/twitter-x.svg";

interface TwitterXIconProps {
  width?: number | string;
  height?: number | string;
}

const TwitterXIcon = ({width, height}: TwitterXIconProps) => {
  return <TwitterXSvg width={width} height={height} />;
};

export default TwitterXIcon;
