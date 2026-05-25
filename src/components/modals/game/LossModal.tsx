/**
 * @fileoverview Loss Modal Component
 *
 * A feedback modal that appears when a player fails to solve a riddle within
 * the allowed attempts. It offers emotional support through encouraging
 * messaging and presents clear options for continuing gameplay.
 *
 * **Key Features:**
 * - Clear loss state communication with supportive messaging
 * - Immediate next level option to encourage continued engagement
 * - Optional continue mechanics (watch ad / use coins)
 * - Accessibility support for all interaction elements
 *
 * **Psychology & UX:**
 * - Encourages immediate re-engagement with prominent next level option
 * - Uses supportive rather than punitive language and design
 *
 * **Design Patterns:**
 * - Error modal variant with red accent color
 * - Clear action hierarchy centered on continuing play
 * - Consistent modal structure and responsive design
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link VictoryModal} For success state counterpart
 */

import React, {useEffect, useMemo, useState} from "react";
import {View, Text, Modal, Animated, Easing} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import {TYPOGRAPHY} from "../../../styles";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";

import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  MODAL_MAX_HEIGHT,
  wheelSize,
} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";
import {isQASurfaceRuntimeActive} from "../../../qa/qaRuntime";

/**
 * Props interface for the LossModal component.
 *
 * Defines all required properties for rendering the loss state modal.
 */
interface LossModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** The correct answer to display for player learning */
  correctAnswer: string;

  /** Callback function executed when user chooses to go to the next level */
  onNext: () => void;

  /** Retained for compatibility with existing call sites */
  onHome: () => void;

  /** Function to close the modal (from BaseModalProps) */
  onClose?: () => void;

  /** When provided, shows a "Watch Ad" button to continue with extra attempts */
  onWatchAdContinue?: () => void | boolean | Promise<void | boolean>;

  /** When provided, shows a "Use Coins" button to continue with extra attempts */
  onCoinContinue?: () => void | boolean | Promise<void | boolean>;

  /** Coin cost shown on the coin-continue button */
  coinContinueCost?: number;

  /** Player's current total coin balance */
  totalCoins?: number;

  /** Retained for compatibility with existing call sites */
  skipLevelCost?: number;

  /** Whether the rewarded ad is ready */
  canWatchAd?: boolean;

  /** Whether the user has enough coins (disables the coin button if false) */
  canUseCoin?: boolean;

  /** Opens the coin shop modal when present */
  onOpenShop?: () => void;
}

/**
 * Loss Modal Component
 *
 * Displays when a player fails to solve a riddle and offers next-step actions
 * to maintain engagement and momentum.
 */
const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onNext,
  onClose,
  onWatchAdContinue,
  onCoinContinue,
  coinContinueCost,
  totalCoins = 0,
  canWatchAd,
  canUseCoin,
  onOpenShop,
}) => {
  const showContinueOptions = !!(onWatchAdContinue || onCoinContinue);
  const isWatchAdDisabled = canWatchAd === false;
  const isCoinContinueDisabled = canUseCoin === false;
  const [rotationAnim] = useState(() => new Animated.Value(0));
  const lossModalHeight = Math.min(MODAL_HEIGHT * 1.2, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.2);
  const wheelBackgroundSize = wheelSize * 1.8;

  const spin = useMemo(() => {
    return rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  }, [rotationAnim]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isVisible && !isQASurfaceRuntimeActive()) {
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
   * Handles skipping to the next level and closes the modal afterward.
   */
  const handleNextLevel = async () => {
    if (typeof onNext === "function") {
      await Promise.resolve(onNext());
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Handles rewarded-ad continue flow; closes unless callback explicitly returns `false`.
   */
  const handleWatchAdContinue = async () => {
    let shouldClose = true;
    if (typeof onWatchAdContinue === "function") {
      const result = await Promise.resolve(onWatchAdContinue());
      shouldClose = result !== false;
    }
    if (shouldClose && typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Handles coin-continue flow; closes unless callback explicitly returns `false`.
   */
  const handleCoinContinue = async () => {
    let shouldClose = true;
    if (typeof onCoinContinue === "function") {
      const result = await Promise.resolve(onCoinContinue());
      shouldClose = result !== false;
    }
    if (shouldClose && typeof onClose === "function") {
      onClose();
    }
  };

  /**
   * Opens the coin shop for players who want to buy more coins.
   */
  const handleOpenShop = async () => {
    if (typeof onOpenShop === "function") {
      await Promise.resolve(onOpenShop());
    }
  };

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {
        // Loss is a terminal decision point; hardware Back must not strand the
        // user on the completed board without the loss actions.
      }}
      accessibilityLabel={AppStrings.Accessibility.GAME_LOSS_NOTIFICATION}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: lossModalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={lossModalHeight}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: lossModalHeight,
              }}
            >
              <MaskedView
                style={{
                  width: MODAL_WIDTH,
                  height: lossModalHeight,
                }}
                maskElement={
                  <View
                    style={{
                      width: MODAL_WIDTH,
                      height: lossModalHeight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ModalBg width={MODAL_WIDTH} height={lossModalHeight} preserveAspectRatio="none" />
                  </View>
                }
              >
                <View
                  style={{
                    width: MODAL_WIDTH,
                    height: lossModalHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      opacity: 0.25,
                      transform: [{rotate: spin}],
                    }}
                  >
                    <WheelBg width={wheelBackgroundSize} height={wheelBackgroundSize} />
                  </Animated.View>
                </View>
              </MaskedView>
            </View>

            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "space-around",
                padding: MODAL_CONTENT_PADDING,
              }}
            >
              {showContinueOptions ? (
                <>
                  <View style={{flex: 1, justifyContent: "center", alignItems: "center"}}>
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: TYPOGRAPHY.fontSize.display,
                        color: "black",
                        textAlign: "center",
                      }}
                    >
                      {AppStrings.LossModal.TITLE}
                    </Text>
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.xl,
                        color: "black",
                        textAlign: "center",
                      }}
                    >
                      {AppStrings.LossModal.EXTRA_GUESSES_PROMPT}
                    </Text>
                  </View>

                  <NewCoins coinsEarned={0} totalCoins={totalCoins} />

                  <View style={{flex: 2, justifyContent: "center", width: "100%"}}>
                    {onWatchAdContinue && (
                      <>
                        <WideButton
                          onPress={handleWatchAdContinue}
                          buttonText={AppStrings.LossModal.WATCH_AD_BUTTON}
                          disabled={isWatchAdDisabled}
                        />
                        <View style={{height: MODAL_BUTTON_SPACER}} />
                      </>
                    )}
                    {onCoinContinue && (
                      <>
                        <WideButton
                          onPress={handleCoinContinue}
                          buttonText={`${AppStrings.LossModal.EXTRA_GUESSES_PREFIX}${coinContinueCost ?? 0}${AppStrings.LossModal.EXTRA_GUESSES_SUFFIX}`}
                          disabled={isCoinContinueDisabled}
                        />
                        <View style={{height: MODAL_BUTTON_SPACER}} />
                      </>
                    )}
                    {onOpenShop && (
                      <>
                        <WideButton onPress={handleOpenShop} buttonText={AppStrings.LossModal.OPEN_SHOP_BUTTON} />
                        <View style={{height: MODAL_BUTTON_SPACER}} />
                      </>
                    )}
                    <WideButton
                      onPress={handleNextLevel}
                      buttonText={AppStrings.LossModal.SKIP_PUZZLE_BUTTON}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: TYPOGRAPHY.fontSize.display,
                        color: "black",
                      }}
                    >
                      {AppStrings.LossModal.TITLE}
                    </Text>
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.xl,
                        color: "black",
                        textAlign: "center",
                      }}
                    >
                      {AppStrings.LossModal.OUT_OF_ATTEMPTS}
                    </Text>
                    {correctAnswer ? (
                      <Text
                        style={{
                          fontFamily: TYPOGRAPHY.fontSecondaryBold,
                          fontSize: TYPOGRAPHY.fontSize.lg,
                          color: "black",
                          marginTop: 12,
                          textAlign: "center",
                        }}
                      >
                        {`${AppStrings.LossModal.ANSWER_PREFIX}${correctAnswer.toUpperCase()}`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{flex: 2, justifyContent: "center", width: "100%"}}>
                    {onOpenShop && (
                      <>
                        <WideButton onPress={handleOpenShop} buttonText={AppStrings.LossModal.OPEN_SHOP_BUTTON} />
                        <View style={{height: MODAL_BUTTON_SPACER}} />
                      </>
                    )}
                    <WideButton onPress={handleNextLevel} buttonText={AppStrings.LossModal.NEXT_LEVEL_BUTTON} />
                  </View>
                </>
              )}
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default LossModal;
