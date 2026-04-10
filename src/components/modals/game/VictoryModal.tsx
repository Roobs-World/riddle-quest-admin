import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Modal, Animated, Easing } from "react-native";
import type { SubmittedGuess } from "../../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../../utils/gameUtils";
import WideButton from "../../buttons/WideButton";
import SocialShareButton from "../../buttons/SocialShareButton";
import LargeCoinStackSvg from "../../../../assets/images/large-coin-stack.svg";
import { COIN_ICON_SIZE_LARGE } from "../../../constants/layout";
import { SocialSharingService } from "../../../services/SocialSharingService";
import { analyticsService } from "../../../services/AnalyticsService";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import { logger } from "../../../utils/logger";
import { captureException } from "../../../utils/sentry";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
} from "../../../constants/layout";

interface VictoryModalProps {
  isVisible: boolean;
  attempts: number;
  coinsEarned: number;
  unlockedAchievementNames?: string[];
  onNextLevel: () => void;
  guesses: SubmittedGuess[];
  gameMode?: "daily" | "classic";
  onClose: () => void;
}

const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  unlockedAchievementNames = [],
  onNextLevel,
  guesses,
  gameMode = "daily",
  onClose,
}) => {
  const [rotationAnim] = useState(() => new Animated.Value(0));
  const [fanfareAnim] = useState(() => new Animated.Value(0));

  const spin = useMemo(() => {
    return rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  }, [rotationAnim]);

  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  const handleShare = async (platform: "facebook" | "x" | "system") => {
    try {
      const shareContent = {
        attempts,
        emojiGrid: emojiSummary,
        gameMode,
      };
      await SocialSharingService.share(platform, shareContent);
      void analyticsService.logShare({ platform, gameMode });
    } catch (error) {
      logger.error(`Error sharing to ${platform}:`, error);
      captureException(error);
    }
  };

  const handleNextLevel = async () => {
    await Promise.resolve(onNextLevel?.());
    onClose?.();
  };

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

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isVisible && unlockedAchievementNames.length > 0) {
      fanfareAnim.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(fanfareAnim, {
            toValue: 1,
            duration: 550,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(fanfareAnim, {
            toValue: 0,
            duration: 550,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }

    return () => {
      animation?.stop();
      fanfareAnim.stopAnimation();
      fanfareAnim.setValue(0);
    };
  }, [isVisible, unlockedAchievementNames.length, fanfareAnim]);

  const fanfareScale = fanfareAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const wheelSize = Math.ceil(
    Math.sqrt(MODAL_WIDTH ** 2 + MODAL_HEIGHT ** 2) * 1.2
  );

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
        <View
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
              justifyContent: "center",
              gap: MODAL_BUTTON_SPACER * 2,
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.display,
                color: "black",
              }}
            >
              Victory!
            </Text>

            {unlockedAchievementNames.length > 0 ? (
              <Animated.View
                style={{
                  transform: [{ scale: fanfareScale }],
                  backgroundColor: "#fef3c7",
                  borderColor: "#f59e0b",
                  borderWidth: 2,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  alignItems: "center",
                  maxWidth: "100%",
                }}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "#92400e",
                  }}
                >
                  Achievement Unlocked!
                </Text>
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: "#78350f",
                    textAlign: "center",
                  }}
                >
                  {unlockedAchievementNames.join(", ")}
                </Text>
              </Animated.View>
            ) : null}

            <View style={{ alignItems: "center" }}>
              <LargeCoinStackSvg
                width={COIN_ICON_SIZE_LARGE}
                height={COIN_ICON_SIZE_LARGE}
              />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "black",
                }}
              >
                +{coinsEarned} Coins
              </Text>
            </View>

            <View style={{ alignItems: "center", width: "100%" }}>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: "black",
                  marginBottom: MODAL_BUTTON_SPACER,
                }}
              >
                Share your victory!
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                <SocialShareButton
                  platform="system"
                  onPress={() => handleShare("system")}
                  size="small"
                />
              </View>
            </View>

            <View style={{ width: "100%" }}>
              <WideButton
                onPress={handleNextLevel}
                buttonText="Next Level"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default VictoryModal;

