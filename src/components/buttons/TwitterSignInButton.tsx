import React from "react";
import TwitterXIcon from "../icons/TwitterXIcon";
import {SIZING, SPACING} from "../../styles";
import SocialSignInButtonShell from "./SocialSignInButtonShell";

interface TwitterSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const TwitterSignInButton: React.FC<TwitterSignInButtonProps> = ({onPress, disabled = false}) => {
  return (
    <SocialSignInButtonShell
      icon={<TwitterXIcon width={SIZING.icon.md} height={SIZING.icon.md} />}
      labelKey="AuthStrings.Login.CONTINUE_WITH_TWITTER"
      onPress={onPress}
      disabled={disabled}
      buttonStyle={{marginBottom: SPACING.md}}
    />
  );
};

export default TwitterSignInButton;
