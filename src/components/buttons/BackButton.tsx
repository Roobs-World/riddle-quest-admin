import { TouchableOpacity } from "react-native";
import BackIcon from "../icons/BackIcon";

export default function BackButton({ navigation }: { navigation: any }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      className="self-start"
    >
      <BackIcon />
    </TouchableOpacity>
  );
}
