import React from "react";
import {View, Text, Modal, type LayoutChangeEvent} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY} from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import {ModalReward} from "@/components/rewards/RewardFactory";

const MODAL_TOP_PADDING = verticalScale(36);
const MODAL_BOTTOM_PADDING = verticalScale(34);
const EXPANDED_MODAL_HEIGHT_MULTIPLIER = 1.18;

const getModalHeight = (contentHeight: number, hasSupplementalCopy: boolean): number => {
  const fallbackHeight = MODAL_HEIGHT * (hasSupplementalCopy ? EXPANDED_MODAL_HEIGHT_MULTIPLIER : 1);
  const contentSizedHeight = contentHeight > 0 ? contentHeight + MODAL_TOP_PADDING + MODAL_BOTTOM_PADDING : fallbackHeight;

  return Math.min(contentSizedHeight, MODAL_MAX_HEIGHT ?? contentSizedHeight);
};

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
  const [contentHeight, setContentHeight] = React.useState(0);
  const skipModalHeight = getModalHeight(contentHeight, !canAffordSkip);

  React.useEffect(() => {
    setContentHeight(0);
  }, [canAffordSkip, skipCost]);

  const handleContentLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setContentHeight((currentHeight) => (Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight));
  }, []);

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
              paddingTop: MODAL_TOP_PADDING,
              paddingBottom: MODAL_BOTTOM_PADDING,
              overflow: "hidden",
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
              height={skipModalHeight * 1.05}
              style={{position: "absolute", top: -skipModalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(4)}}
            />
            <View
              onLayout={handleContentLayout}
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

              <ModalReward amount={-skipCost} totalCoins={totalCoins} />

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
