import React from "react";
import SettingsSvg from "@images/settings-icon.svg";

interface SettingsIconProps {
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
}

const SettingsIcon: React.FC<SettingsIconProps> = ({
  width = 24,
  height = 24,
  color = "#222",
  testID,
}) => {
  return (
    <SettingsSvg width={width} height={height} fill={color} testID={testID} />
  );
};

export default SettingsIcon;
