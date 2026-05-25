import React from "react";
import SettingsSvg from "../../../assets/images/settings-icon.svg";

interface SettingsIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  testID?: string;
}

const SettingsIcon: React.FC<SettingsIconProps> = ({width = 24, height = 24, color, testID = "settings-icon"}) => {
  return <SettingsSvg width={width} height={height} color={color} testID={testID} />;
};

export default SettingsIcon;
