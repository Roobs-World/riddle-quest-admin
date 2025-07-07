import { Text, TouchableOpacity } from "react-native";
import { TYPOGRAPHY } from "src/styles";

type ModalButtonProps = {
  text: string;
  callback: () => void;
  isDisabled: boolean;
};

export const ModalButton = ({
  text,
  callback,
  isDisabled,
}: ModalButtonProps): JSX.Element => {
  return (
    <TouchableOpacity
      disabled={isDisabled}
      className={`${
        isDisabled ? "bg-gray-400" : "bg-secondary-orange"
      } px-4 py-2 rounded-full h-12 mx-2 items-center justify-center`}
      onPress={callback}
    >
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontPrimary,
          color: "black",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
};
