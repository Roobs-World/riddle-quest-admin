import { TouchableOpacity } from "react-native";
import BackIcon from "../icons/BackIcon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppStrings } from "../../constants/AppStrings";

type NavigationProp = NativeStackNavigationProp<
  Record<string, object | undefined>
>;

export default function BackButton({
  navigation,
  targetScreen,
}: {
  navigation: NavigationProp;
  targetScreen?: string;
}) {
  const handlePress = () => {
    if (targetScreen) {
      navigation.navigate(targetScreen as never);
    } else {
      // Default behavior for auth screens - navigate to Landing
      navigation.navigate(AppStrings.Navigation.LANDING as never);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
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
