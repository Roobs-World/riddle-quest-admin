import { View, Text } from "react-native";
import TreasureChestBgSvg from "../../../../assets/images/treasure-chest.svg";

export default function TreasureChest({ coins }: { coins: number }) {
  return (
    <View className="w-full">
      <Text className="text-lg font-semibold mb-4 text-black text-left">
        Your Treasure Chest
      </Text>
      <View className="relative w-48 h-48 items-center justify-center mx-auto">
        <TreasureChestBgSvg width={192} height={192} />
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-sm text-black mb-1">Total Coins:</Text>
          <Text className="text-2xl font-bold text-black">{coins}</Text>
        </View>
      </View>
    </View>
  );
}
