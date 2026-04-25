import React from "react";
import {View, Text, Modal, TouchableOpacity} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import {NewCoins} from "@/components/shared/NewCoins";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";

interface LevelUpFanfareModalProps {
  isVisible: boolean;
  newLevel: number;
  coinsAwarded: number;
  totalCoins: number;
  onClose: () => void;
}

const LEVEL_UP_FANFARE_MODAL_HEIGHT = MODAL_HEIGHT * 1.4;

const LevelUpFanfareModal: React.FC<LevelUpFanfareModalProps> = ({
  isVisible,
  newLevel,
  coinsAwarded,
  totalCoins,
  onClose,
}) => {
  return (
    <Modal transparent animationType="fade" visible={isVisible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          paddingTop: verticalScale(30),
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />

        <SlideInModalContent isVisible={isVisible}>
          <TouchableOpacity key={"coin-purchase-modal"} onPress={onClose}>
            <View
              style={{
                width: MODAL_WIDTH,
                height: LEVEL_UP_FANFARE_MODAL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <ModalBg
                width={MODAL_WIDTH}
                height={LEVEL_UP_FANFARE_MODAL_HEIGHT}
                style={{position: "absolute"}}
                preserveAspectRatio="none"
              />
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={LEVEL_UP_FANFARE_MODAL_HEIGHT * 1.1}
                style={{
                  position: "absolute",
                  top: -LEVEL_UP_FANFARE_MODAL_HEIGHT * 0.05,
                  left: -MODAL_WIDTH * 0.05,
                }}
              />

              <View
                style={{
                  flex: 1,
                  width: "100%",
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
                    marginTop: verticalScale(-40),
                  }}
                >
                  {AppStrings.LevelUpFanfare.TITLE}
                </Text>

                <View style={{alignItems: "center"}}>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      fontSize: TYPOGRAPHY.fontSize["2xl"],
                      color: "black",
                      marginBottom: 6,
                    }}
                  >
                    {`${AppStrings.LevelUpFanfare.LEVEL_PREFIX}${newLevel}`}
                  </Text>

                  <NewCoins coinsEarned={coinsAwarded} totalCoins={totalCoins} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default LevelUpFanfareModal;
