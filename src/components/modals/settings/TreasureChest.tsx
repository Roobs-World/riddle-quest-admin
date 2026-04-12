import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import TreasureChestRaysSvg from "../../../../assets/images/treasure-chest-rays.svg";
import TreasureChestSvg from "../../../../assets/images/treasure-chest.svg";
import { TYPOGRAPHY, SPACING } from "../../../styles";
import { verticalScale } from "../../../utils/responsive";
import { AppStrings } from "../../../constants/AppStrings";

export default function TreasureChest({ coins }: { coins: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const raysStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  return (
    <View className="w-full">
      <Text
        className="text-black text-left"
        style={{ fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize.lg, marginBottom: SPACING.md }}
      >
        {AppStrings.Profile.TREASURE_CHEST_TITLE}
      </Text>
      <View
        style={{
          width: "100%",
          height: verticalScale(192),
          borderRadius: 16,
          backgroundColor: "#E2DCC7",
          overflow: "hidden",
        }}
      >
        {/* Rotating background rays — oversized so corners stay covered at all angles */}
        <Animated.View
          style={[{
            position: "absolute",
            width: "200%",
            height: "200%",
            top: "-50%",
            left: "-50%",
          }, raysStyle]}
          pointerEvents="none"
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <TreasureChestRaysSvg width="100%" height="100%" />
        </Animated.View>

        {/* Static chest graphic (transparent background) */}
        <View style={{ position: "absolute", width: "100%", height: "100%" }}>
          <TreasureChestSvg width="100%" height="100%" />
        </View>

        {/* Coins text */}
        <View style={{ position: "absolute", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Text
            className="text-black"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize["2xl"], marginBottom: SPACING.xs, marginTop: verticalScale(96) }}
          >
            {AppStrings.Profile.TOTAL_COINS_LABEL}
          </Text>
          <Text
            className="text-black"
            style={{ fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize["2xl"] }}
          >
            {coins}
          </Text>
        </View>
      </View>
    </View>
  );
}

