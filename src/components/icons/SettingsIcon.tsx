import React from "react";
import SettingsSvg from "../../../assets/images/settings-icon.svg";

interface SettingsIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  testID?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SettingsIcon: React.FC<SettingsIconProps> = ({
  width = 24,
  height = 24,
  color,
  testID = "settings-icon",
}) => {
  return <SettingsSvg width={width} height={height} testID={testID} />;
};

export default SettingsIcon;
