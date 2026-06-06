import React from "react";
import FacebookIcon from "../icons/FacebookIcon";
import {SIZING} from "../../styles";
import SocialSignInButtonShell from "./SocialSignInButtonShell";

interface FacebookSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const FacebookSignInButton: React.FC<FacebookSignInButtonProps> = ({onPress, disabled = false}) => {
  return (
    <SocialSignInButtonShell
      icon={<FacebookIcon width={SIZING.icon.md} height={SIZING.icon.md} />}
      labelKey="AuthStrings.Login.CONTINUE_WITH_FACEBOOK"
      onPress={onPress}
      disabled={disabled}
    />
  );
};

export default FacebookSignInButton;
