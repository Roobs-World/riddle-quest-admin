import { View, Text } from "react-native";
import { styles } from "../../../styles";
import TreasureChestBgSvg from "../../../../assets/images/treasure-chest.svg";

export default function TreasureChest({ coins }: { coins: number }) {
  return (
    <View>
      <Text>Your Treasure Chest</Text>
      <TreasureChestBgSvg
        width="100%"
        height="100%"
        style={styles.backgroundImage}
      />
      <Text>Total Coins:</Text>
      <Text>{coins}</Text>
    </View>
  );
}
