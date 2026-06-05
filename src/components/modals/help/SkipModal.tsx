import React from "react";
import {View, Text, Modal} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY} from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH, MODAL_HEIGHT, CLOSE_BUTTON_SIZE, MODAL_CLOSE_BUTTON_POSITION, MODAL_MAX_HEIGHT, } from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import {NewCoins} from "@/components/shared/NewCoins";

interface SkipModalProps {
  isVisible: boolean;
  userCoins: number;
  totalCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
  onOpenShop: () => void;
  onClose: () => void;
}

const SkipModal: React.FC<SkipModalProps> = ({
  isVisible,
  userCoins,
  totalCoins,
  skipCost,
  onSkipLevel,
  onOpenShop,
  onClose,
}) => {
  const canAffordSkip = userCoins >= skipCost;
  const skipModalHeightMultiplier = canAffordSkip ? 1.4 : 1.6;
  const skipModalHeight = Math.min(
    MODAL_HEIGHT * skipModalHeightMultiplier,
    MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * skipModalHeightMultiplier,
  );

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: skipModalHeight,
              alignItems: "center",
              paddingTop: verticalScale(36),
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={skipModalHeight}
              style={{position: "absolute"}}
              preserveAspectRatio="none"
            />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              style={{position: "absolute", top: -skipModalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(4)}}
            />
            <View
              style={{
                width: "80%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.title,
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {t("GameScreenAlerts.SKIP_MODAL_TITLE")}
              </Text>

              <NewCoins coinsEarned={-skipCost} totalCoins={totalCoins} />

              {!canAffordSkip && (
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    marginBottom: SPACING.lg,
                    marginTop: SPACING.lg,
                    textAlign: "center",
                  }}
                >
                  {t("GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE")}
                </Text>
              )}
              <View style={{width: "100%", marginTop: SPACING.md}}>
                <WideButton
                  buttonText={
                    canAffordSkip
                      ? t("GameScreenAlerts.SKIP_LEVEL_BUTTON")
                      : t("Navigation.BUY_COINS_BUTTON")
                  }
                  onPress={() => {
                    onClose();
                    if (canAffordSkip) {
                      onSkipLevel();
                    } else {
                      onOpenShop();
                    }
                  }}
                  disabled={false}
                />
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default SkipModal;
