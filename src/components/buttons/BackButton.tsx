import { TouchableOpacity } from "react-native";
import BackIcon from "../icons/BackIcon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type NavigationProp = NativeStackNavigationProp<
  Record<string, object | undefined>
>;

export default function BackButton({
  navigation,
}: {
  navigation: NavigationProp;
}) {
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      className="p-4"
      style={{
        position: "absolute",
        left: 0,
        top: 2,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <BackIcon />
    </TouchableOpacity>
  );
}
