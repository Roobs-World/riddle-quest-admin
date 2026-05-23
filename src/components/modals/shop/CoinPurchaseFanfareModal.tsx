import React from "react";
import {View, Text, Modal} from "react-native";

import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER, getResponsiveModalHeight} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";

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
  const modalHeight = getResponsiveModalHeight(1.2);
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
        onTouchEnd={handleConfirm}
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
                {AppStrings.CoinPurchase.TITLE}
              </Text>

              <NewCoins coinsEarned={coinsPurchased} totalCoins={totalCoins} />
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default CoinPurchaseFanfareModal;
