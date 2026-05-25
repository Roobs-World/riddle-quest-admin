import React from "react";
import ProfileSvg from "../../../assets/images/profile-icon.svg";

interface ProfileIconProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  testID?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ProfileIcon: React.FC<ProfileIconProps> = ({width = 24, height = 24, color, testID = "profile-icon"}) => {
  return <ProfileSvg width={width} height={height} color={color} testID={testID} />;
};

export default ProfileIcon;
