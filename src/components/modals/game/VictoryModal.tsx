import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Modal, TouchableOpacity, Animated, Easing } from "react-native";
import type { SubmittedGuess } from "../../../hooks/types";
import CoinSvg from "../../../../assets/images/coin.svg";
import ChestSvg from "../../../../assets/images/chest.svg";
import SegmentBgSvg from "../../../../assets/images/segment-bg.svg";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  COIN_ICON_SIZE_LARGE,
  wheelSize,
} from "../../../constants/layout";
import { AppStrings } from "../../../constants/AppStrings";


/**
 * Props for the victory feedback modal shown after a successful solve.
 */
interface VictoryModalProps {
  /** Controls modal visibility state. */
  isVisible: boolean;
  /** Number of attempts used to solve the riddle. */
  attempts: number;
  /** Coin reward earned for this win. */
  coinsEarned: number;
  /** Optional list of achievement names unlocked by this win. */
  unlockedAchievementNames?: string[];
  /** Optional current wallet balance shown in the summary strip. */
  totalCoins?: number;
  /** Callback for advancing to the next level/riddle. */
  onNextLevel: () => void;
  /** Submitted guesses used to build shareable emoji summary. */
  guesses: SubmittedGuess[];
  /** Game mode label included in share analytics/payload. */
  gameMode?: "daily" | "classic";
  /** Closes the modal. */
  onClose: () => void;
}

/**
 * Celebratory modal with rewards, optional achievement fanfare, and sharing CTA.
 *
 * @param props Victory details and user action callbacks.
 * @returns Animated victory modal view.
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  coinsEarned,
  totalCoins,
  onNextLevel,
  onClose,
}) => {

  const [rotationAnim] = useState(() => new Animated.Value(0));

  const spin = useMemo(() => {
    return rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  }, [rotationAnim]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isVisible) {
      rotationAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    }

    return () => {
      animation?.stop();
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    };
  }, [isVisible, rotationAnim]);

  /**
   * Advances to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    await Promise.resolve(onNextLevel?.());
    onClose?.();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <TouchableOpacity
          testID="victory-card-pressable"
          accessibilityRole="button"
          accessibilityLabel={AppStrings.VictoryModal.NEXT_LEVEL_BUTTON}
          activeOpacity={1}
          onPress={() => {
            void handleNextLevel();
          }}
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg
            width={MODAL_WIDTH}
            height={MODAL_HEIGHT}
            style={{ position: "absolute" }}
          />

          <View
            style={{
              position: "absolute",
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              overflow: "hidden",
              borderRadius: 30,
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                left: (MODAL_WIDTH - wheelSize) / 2,
                top: (MODAL_HEIGHT - wheelSize) / 2,
                opacity: 0.25,
                transform: [{ rotate: spin }],
              }}
            >
              <WheelBg width={wheelSize} height={wheelSize} />
            </Animated.View>
          </View>

          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["4xl"],
                color: "black",
                marginTop: 20,
              }}
            >
              {AppStrings.VictoryModal.TITLE}
            </Text>

            <View style={{ alignItems: "center", marginTop: 5 }}>
              <CoinSvg
                width={COIN_ICON_SIZE_LARGE * 1.5}
                height={COIN_ICON_SIZE_LARGE * 1.5}
              />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "#FB9A2B",
                  marginTop: 10,
                }}
              >
                +{coinsEarned}{AppStrings.VictoryModal.COINS_SUFFIX}
              </Text>
            </View>

            <View
              style={{
                width: "100%",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <View style={{ width: "100%", alignItems: "center" }}>
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
                {typeof totalCoins === "number" ? totalCoins : coinsEarned}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default VictoryModal;
