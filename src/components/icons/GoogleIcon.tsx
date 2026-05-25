import React from "react";
import GoogleSvg from "@images/google.svg";

interface GoogleIconProps {
  width?: number | string;
  height?: number | string;
}

const GoogleIcon = ({width, height}: GoogleIconProps) => {
  return <GoogleSvg width={width} height={height} />;
};

export default GoogleIcon;
