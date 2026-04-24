import React from "react";
import {Text, View} from "react-native";
import CoinSvg from "../../../assets/images/coin.svg";
import ChestSvg from "../../../assets/images/chest.svg";
import SegmentBgSvg from "../../../assets/images/segment-bg.svg";
import {TYPOGRAPHY} from "../../styles";
import {COIN_ICON_SIZE_LARGE, MODAL_CONTENT_PADDING, MODAL_WIDTH} from "../../constants/layout";
import {AppStrings} from "../../constants/AppStrings";

interface NewCoinsProps {
  coinsEarned: number;
  totalCoins: number;
}

export const NewCoins = ({coinsEarned, totalCoins}: NewCoinsProps): React.JSX.Element => {
  return (
    <View>
      <View style={{alignItems: "center", marginTop: 5}}>
        <CoinSvg width={COIN_ICON_SIZE_LARGE} height={COIN_ICON_SIZE_LARGE} />
        <Text
          style={{
            fontFamily: TYPOGRAPHY.fontSecondaryBold,
            fontSize: TYPOGRAPHY.fontSize["4xl"],
            color: "#FB9A2B",
            marginTop: 10,
          }}
        >
          +{coinsEarned}
          {AppStrings.VictoryModal.COINS_SUFFIX}
        </Text>
      </View>

      <View
        style={{
          width: "100%",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <View style={{width: "100%", alignItems: "center"}}>
          <SegmentBgSvg width={MODAL_WIDTH - MODAL_CONTENT_PADDING * 2} height={86} />
        </View>
        <View
          style={{
            position: "absolute",
            left: 22,
            top: 9,
          }}
        >
          <ChestSvg width={62} height={62} />
        </View>
        <Text
          style={{
            position: "absolute",
            left: 175,
            top: 15,
            fontFamily: TYPOGRAPHY.fontSecondaryBold,
            fontSize: TYPOGRAPHY.fontSize.base,
            color: "#7D7E84",
          }}
        >
          {AppStrings.VictoryModal.TOTAL_COINS_LABEL}
        </Text>
        <Text
          style={{
            position: "absolute",
            left: 175,
            top: 35,
            fontFamily: TYPOGRAPHY.fontSecondaryBold,
            fontSize: TYPOGRAPHY.fontSize["3xl"],
            color: "#000000",
          }}
        >
          {totalCoins}
        </Text>
      </View>
    </View>
  );
};
