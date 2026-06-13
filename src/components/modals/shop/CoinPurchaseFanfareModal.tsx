import React from "react";
import {View, Text, Modal} from "react-native";

import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER, MODAL_MAX_SCREEN_HEIGHT_FRACTION, getResponsiveModalHeight, } from "../../../constants/layout";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {ModalReward} from "@/components/rewards/RewardFactory";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import WideButton from "../../buttons/WideButton";

interface CoinPurchaseFanfareModalProps {
  isVisible: boolean;
  coinsPurchased: number;
  totalCoins: number;
  onConfirm?: () => void;
  onClose: () => void;
}

const CoinPurchaseFanfareModal: React.FC<CoinPurchaseFanfareModalProps> = ({
  isVisible,
  coinsPurchased,
  totalCoins,
  onConfirm,
  onClose,
}) => {
  const modalHeight = getResponsiveModalHeight(1.45, MODAL_MAX_SCREEN_HEIGHT_FRACTION);
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Modal transparent animationType="none" visible={isVisible} onRequestClose={handleConfirm}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={modalHeight}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={modalHeight * 1.05}
              style={{position: "absolute", top: -modalHeight * 0.08, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: modalHeight,
                alignItems: "center",
                justifyContent: "center",
                gap: MODAL_BUTTON_SPACER,
                padding: MODAL_CONTENT_PADDING,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  color: "black",
                  textAlign: "center",
                }}
              >
                {t("CoinPurchase.TITLE")}
              </Text>

              <ModalReward amount={coinsPurchased} totalCoins={totalCoins} />

              <View style={{width: "100%"}}>
                <WideButton
                  buttonText={t("CoinPurchase.AWESOME_BUTTON")}
                  onPress={handleConfirm}
                  testID="coin-purchase-fanfare-confirm-button"
                />
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default CoinPurchaseFanfareModal;
