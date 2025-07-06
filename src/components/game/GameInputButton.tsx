import { ReactElement } from "react";
import { Text, TouchableOpacity } from "react-native";

type GameInputButtonProps = {
  icon: ReactElement;
  text: string;
  callback: () => void;
};

export const GameInputButton = ({
  text,
  icon,
  callback,
}: GameInputButtonProps): JSX.Element => {
  return (
    <TouchableOpacity
      className="px-4 py-2 rounded-full mx-auto bg-key-bg h-12 flex-row items-center justify-center space-x-2"
      onPress={callback}
    >
      {icon}
      <Text className="text-black font-bold text-lg ml-2">{text}</Text>
    </TouchableOpacity>
  );
};
