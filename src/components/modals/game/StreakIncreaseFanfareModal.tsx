import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";

interface StreakIncreaseFanfareModalProps {
  isVisible: boolean;
  streakValue: number;
  coinsAwarded: number;
  totalCoins: number;
  onClose: () => void;
}

const StreakIncreaseFanfareModal: React.FC<StreakIncreaseFanfareModalProps> = ({
  isVisible,
  streakValue,
  coinsAwarded,
  totalCoins,
  onClose,
}) => {
  const streakModalHeight = MODAL_HEIGHT * 1.4;

  return (
    <Modal transparent animationType="fade" visible={isVisible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible}>
          <TouchableOpacity key={"streak-increase-fanfare-modal"} onPress={onClose}>
            <View
              style={{
                width: MODAL_WIDTH,
                height: streakModalHeight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ModalBg
                width={MODAL_WIDTH}
                height={streakModalHeight}
                style={{position: "absolute"}}
                preserveAspectRatio="none"
              />
              {/* Decorative wave - clipped to card bounds */}
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={MODAL_HEIGHT * 1.1}
                style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
              />

              <View
                style={{
                  position: "absolute",
                  width: MODAL_WIDTH,
                  height: streakModalHeight,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: MODAL_BUTTON_SPACER * 2,
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
                  {AppStrings.StreakFanfare.TITLE}
                </Text>

                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {`${streakValue}${AppStrings.StreakFanfare.STREAK_SUFFIX}`}
                </Text>

                <NewCoins coinsEarned={coinsAwarded} totalCoins={totalCoins} />
              </View>
            </View>
          </TouchableOpacity>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default StreakIncreaseFanfareModal;
