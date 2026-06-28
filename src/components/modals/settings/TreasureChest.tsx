import {useEffect, useMemo, useState, type RefObject} from "react";
import {View, Text, Animated, Easing} from "react-native";
import TreasureChestRaysSvg from "../../../../assets/images/treasure-chest-rays.svg";
import TreasureChestOpenSvg from "../../../../assets/images/chest-open.svg";
import {TYPOGRAPHY, SPACING} from "../../../styles";
import {verticalScale} from "../../../utils/responsive";
import {t} from "../../../i18n";
import {isQASurfaceRuntimeActive} from "../../../qa/qaRuntime";

type TreasureChestProps = {
  coins: number;
  cardRef?: RefObject<View | null>;
  cardTestID?: string;
};

export default function TreasureChest({coins, cardRef, cardTestID}: TreasureChestProps) {
  const [rotationAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    rotationAnim.setValue(0);
    if (isQASurfaceRuntimeActive()) {
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      animation.stop();
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    };
  }, [rotationAnim]);

  const spin = useMemo(
    () =>
      rotationAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [rotationAnim],
  );

  return (
    <View className="w-full">
      <View
        ref={cardRef}
        testID={cardTestID}
        style={{
          width: "100%",
          height: verticalScale(192),
          borderRadius: 16,
          backgroundColor: "#E2DCC7",
          overflow: "hidden",
          marginTop: verticalScale(20),
        }}
      >
        {/* Rotating background rays — oversized so corners stay covered at all angles */}
        <Animated.View
          style={{
            position: "absolute",
            width: "200%",
            height: "200%",
            top: "-50%",
            left: "-50%",
            transform: [{rotate: spin}],
          }}
          pointerEvents="none"
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <TreasureChestRaysSvg width="100%" height="100%" />
        </Animated.View>

        {/* Static chest graphic (transparent background) */}
        <View
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            alignContent: "center",
            alignItems: "center",
            paddingTop: verticalScale(25),
          }}
        >
          <TreasureChestOpenSvg width="50%" height="50%" />
        </View>

        {/* Coins text */}
        <View
          style={{position: "absolute", width: "100%", height: "100%", alignItems: "center", justifyContent: "center"}}
        >
          <Text
            className="text-black"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              marginBottom: SPACING.xs,
              marginTop: verticalScale(96),
            }}
          >
            {t("Profile.TOTAL_COINS_LABEL")}
          </Text>
          <Text
            className="text-black"
            style={{fontFamily: TYPOGRAPHY.fontPrimary, fontSize: TYPOGRAPHY.fontSize["2xl"]}}
          >
            {coins}
          </Text>
        </View>
      </View>
    </View>
  );
}
