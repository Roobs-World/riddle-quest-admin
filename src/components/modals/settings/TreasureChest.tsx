import { View, Text } from "react-native";
import TreasureChestBgSvg from "../../../../assets/images/treasure-chest.svg";
import { TYPOGRAPHY } from "../../../styles";

export default function TreasureChest({ coins }: { coins: number }) {
  return (
    <View className="w-full">
      <Text
        className="text-lg mb-4 text-black text-left"
        style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
      >
        Your Treasure Chest
      </Text>
      <View className="relative w-full h-48 items-center justify-center">
        <TreasureChestBgSvg width="100%" height="100%" />
        <View className="absolute inset-0 items-center justify-center">
          <Text
            className="text-black mb-1 mt-24 text-2xl"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            Total Coins:
          </Text>
          <Text
            className="text-2xl text-black"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            {coins}
          </Text>
        </View>
      </View>
    </View>
  );
}
