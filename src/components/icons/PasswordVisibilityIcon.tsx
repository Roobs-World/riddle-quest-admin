import React from "react";
import EyeSvg from "@images/eye.svg";
import EyeOpenSvg from "@images/eye-open.svg";

interface PasswordVisibilityIconProps {
  visible: boolean;
}

const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({
  visible,
}) => {
  return visible ? (
    <EyeOpenSvg width={18} height={16} />
  ) : (
    <EyeSvg width={18} height={16} />
  );
};

export default PasswordVisibilityIcon;
