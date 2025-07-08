import { View, Text } from "react-native";
import TreasureChestBgSvg from "../../../../assets/images/treasure-chest.svg";
import { TYPOGRAPHY } from "src/styles";

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
        <TreasureChestBgSvg width="100%" height={192} />
        <View className="absolute inset-0 items-center justify-center">
          <Text
            className="text-sm text-black mb-1"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            Total Coins:
          </Text>
          <Text
            className="text-2xl font-bold text-black"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
          >
            {coins}
          </Text>
        </View>
      </View>
    </View>
  );
}
