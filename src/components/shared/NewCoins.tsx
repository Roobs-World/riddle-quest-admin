import React from "react";
import {Text, View} from "react-native";
import CoinSvg from "../../../assets/images/coin.svg";
import {TYPOGRAPHY} from "../../styles";
import {COIN_ICON_SIZE_LARGE, MODAL_CONTENT_PADDING, MODAL_WIDTH} from "../../constants/layout";
import {AppStrings} from "../../constants/AppStrings";
import TreasureChest from "../modals/settings/TreasureChest";

interface NewCoinsProps {
  coinsEarned: number;
  totalCoins: number;
}

export const NewCoins = ({coinsEarned, totalCoins}: NewCoinsProps): React.JSX.Element => {
  const chestWidth = MODAL_WIDTH - MODAL_CONTENT_PADDING * 2;
  const displayTotalCoins = Number.isFinite(totalCoins) ? totalCoins : coinsEarned;

  return (
    <View style={{width: chestWidth}}>
      {coinsEarned > 0 && (
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
      )}
      <TreasureChest coins={displayTotalCoins} />
    </View>
  );
};
