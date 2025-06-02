import React from "react";
import ProfileSvg from "@images/profile-icon.svg";

interface ProfileIconProps {
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
}

const ProfileIcon: React.FC<ProfileIconProps> = ({
  width = 24,
  height = 24,
  color = "#222",
  testID,
}) => {
  return (
    <ProfileSvg width={width} height={height} fill={color} testID={testID} />
  );
};

export default ProfileIcon;
