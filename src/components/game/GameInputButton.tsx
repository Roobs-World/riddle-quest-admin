import { ReactElement } from "react";
import { Text, TouchableOpacity } from "react-native";
import { GAME_INPUT_BUTTON_HEIGHT } from "../../constants/layout";
import { SPACING, TYPOGRAPHY } from "../../styles";

type GameInputButtonProps = {
  icon: ReactElement;
  text: string;
  callback: () => void;
};

export const GameInputButton = ({
  text,
  icon,
  callback,
}: GameInputButtonProps): ReactElement => {
  return (
    <TouchableOpacity
      className="rounded-full bg-key-bg flex-row items-center justify-center"
      style={{ height: GAME_INPUT_BUTTON_HEIGHT, paddingHorizontal: SPACING.md, gap: SPACING.sm }}
      onPress={callback}
    >
      {icon}
      <Text style={{ fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontPrimary, color: "black" }}>{text}</Text>
    </TouchableOpacity>
  );
};
