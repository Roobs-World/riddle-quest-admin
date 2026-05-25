import React from "react";
import EyeSvg from "@images/eye.svg";
import EyeOpenSvg from "@images/eye-open.svg";
import {moderateScale} from "../../utils/responsive";

interface PasswordVisibilityIconProps {
  visible: boolean;
}

const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({visible}) => {
  return visible ? (
    <EyeOpenSvg width={moderateScale(18)} height={moderateScale(16)} />
  ) : (
    <EyeSvg width={moderateScale(18)} height={moderateScale(16)} />
  );
};

export default PasswordVisibilityIcon;
