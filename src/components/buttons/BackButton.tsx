import { TouchableOpacity, StyleSheet } from "react-native";
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
      style={styles.backButton}
    >
      <BackIcon />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 2,
    zIndex: 10,
  },
});
