import React from "react";
import { TouchableOpacity } from "react-native";
import BackIcon from "@images/back-icon.svg";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { styles } from "../../styles";

/**
 * Props for the BackButton component.
 * @property {NativeStackNavigationProp<RootStackParamList>} navigation - The navigation prop from React Navigation.
 * @property {string} [targetScreen] - Optional target screen to navigate to. If not provided, will go back to previous screen.
 */
interface BackButtonProps<
  RootStackParamList extends Record<string, object | undefined>
> {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  targetScreen?: keyof RootStackParamList;
}

/**
 * A back button component that navigates to a specific screen or goes back to the previous screen.
 * @param {BackButtonProps} props - The props for the component.
 * @returns {React.FC<BackButtonProps>} The rendered BackButton component.
 */
const BackButton = <
  RootStackParamList extends Record<string, object | undefined>
>({
  navigation,
  targetScreen,
}: BackButtonProps<RootStackParamList>) => {
  const handlePress = () => {
    if (targetScreen) {
      navigation.navigate(targetScreen as never);
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="p-1"
      style={styles.backButton}
    >
      <BackIcon width={35} height={35} />
    </TouchableOpacity>
  );
};

export default BackButton;
