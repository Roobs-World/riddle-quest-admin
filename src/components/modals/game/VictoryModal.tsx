import React, {useEffect, useMemo, useState} from "react";
import {View, Text, Modal, TouchableOpacity, Animated, Easing} from "react-native";
import type {SubmittedGuess} from "../../../hooks/types";
import {TYPOGRAPHY} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, wheelSize} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import {verticalScale} from "@/utils/responsive";

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
  totalCoins: number;
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
const VictoryModal: React.FC<VictoryModalProps> = ({isVisible, coinsEarned, totalCoins, onNextLevel, onClose}) => {
  const modalHeight = MODAL_HEIGHT * 1.2;
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
        }),
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

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: modalHeight,
                overflow: "hidden",
                borderRadius: 30,
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  left: (MODAL_WIDTH - wheelSize) / 2,
                  top: (modalHeight - wheelSize) / 2,
                  opacity: 0.25,
                  transform: [{rotate: spin}],
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
                marginBottom: verticalScale(20),
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

              <NewCoins coinsEarned={coinsEarned} totalCoins={totalCoins} />
            </View>
          </TouchableOpacity>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default VictoryModal;
