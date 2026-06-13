/**
 * @fileoverview
 * Game header component showing the Riddle Quest logo, coin balance, and mode label.
 *
 * This header is used at the top of the main `GameScreen` and is responsible
 * for providing quick access to the coin shop and surfacing current mode context.
 */
import React, {useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import {LayoutChangeEvent, View, TouchableOpacity, Text} from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LogoIcon from "../icons/LogoIcon";
import {TYPOGRAPHY, SPACING} from "../../styles";
import {GAME_HEADER_SLOT_HEIGHT, HEADER_LOGO_SIZE} from "../../constants/layout";
import {t} from "../../i18n";
import {useRewardAnimation} from "../../contexts/RewardAnimationContext";

/**
 * Props for the Header component.
 * @property {number} userCoins - The current user's coin balance.
 * @property {() => void} onCoinsPress - Function to call when the coins are pressed (opens shop).
 * @property {() => void} onHintPress - Function to call when the hint button is pressed.
 */
interface HeaderProps {
  /** Current coin balance shown on the right side of the header. */
  userCoins: number;
  /** Opens the coin shop when the coin display is pressed. */
  onCoinsPress: () => void;
  /** Optional logo press handler (e.g. open hint / info). */
  onHintPress?: () => void;
  /** Optional mode label (e.g. "Daily Challenge"). */
  modeLabel?: string;
  /** Allows coin increase animations when true. */
  shouldAnimateCoins?: boolean;
  coinsButtonRef?: React.Ref<View>;
}

/**
 * Header component for the main game screen.
 *
 * Renders the Riddle Quest logo, current coin balance, and an optional centered
 * mode label. Callers are expected to wire `onCoinsPress` to open the coin
 * shop and may use `onHintPress` for future logo interactions.
 *
 * @param props Props controlling coin display and optional mode label.
 */
const Header: React.FC<HeaderProps> = ({
  userCoins,
  onCoinsPress,
  onHintPress,
  modeLabel,
  shouldAnimateCoins = true,
  coinsButtonRef,
}) => {
  const showModeLabel = !!modeLabel;
  const [headerWidth, setHeaderWidth] = useState(0);
  const [leftAnchor, setLeftAnchor] = useState({x: SPACING.md, width: HEADER_LOGO_SIZE});
  const [rightAnchor, setRightAnchor] = useState({x: 0, width: 0});
  const {registerCoinTarget} = useRewardAnimation();
  const localCoinsTargetRef = useRef<View>(null);

  useImperativeHandle(coinsButtonRef, () => localCoinsTargetRef.current as View);

  useEffect(() => {
    registerCoinTarget(localCoinsTargetRef.current);
    return () => registerCoinTarget(null);
  }, [registerCoinTarget]);

  const modeLabelContainerStyle = useMemo(() => {
    const leftBoundary = leftAnchor.x + leftAnchor.width;
    const rightBoundary = rightAnchor.x;
    const rightInset = headerWidth > 0 ? Math.max(0, headerWidth - rightBoundary) : SPACING.md;

    // Center the label within the live space between logo and coins so it never overlaps either side.
    if (headerWidth > 0 && rightBoundary > leftBoundary) {
      return {top: 0, bottom: 0, left: leftBoundary, right: rightInset, transform: [{translateY: 4}]};
    }

    // Safe fallback before first layout pass.
    return {top: 0, bottom: 0, left: SPACING.xl, right: SPACING.xl, transform: [{translateY: 4}]};
  }, [headerWidth, leftAnchor, rightAnchor]);

  const handleHeaderLayout = (event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    setHeaderWidth((previousWidth) => (previousWidth === width ? previousWidth : width));
  };

  const handleLeftAnchorLayout = (event: LayoutChangeEvent) => {
    const {x, width} = event.nativeEvent.layout;
    setLeftAnchor((previousAnchor) =>
      previousAnchor.x === x && previousAnchor.width === width ? previousAnchor : {x, width},
    );
  };

  const handleRightAnchorLayout = (event: LayoutChangeEvent) => {
    const {x, width} = event.nativeEvent.layout;
    setRightAnchor((previousAnchor) =>
      previousAnchor.x === x && previousAnchor.width === width ? previousAnchor : {x, width},
    );
  };

  return (
    <View
      className="w-full flex-row items-center justify-between relative"
      style={{
        minHeight: GAME_HEADER_SLOT_HEIGHT,
        maxHeight: GAME_HEADER_SLOT_HEIGHT,
        height: GAME_HEADER_SLOT_HEIGHT,
        paddingHorizontal: SPACING.md,
      }}
      testID="header"
      onLayout={handleHeaderLayout}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel={t("Accessibility.GAME_HEADER")}
    >
      {/* Logo Icon in top-left corner - positioned absolutely like CloseButton */}
      <View
        style={{position: "absolute", top: SPACING.md, left: SPACING.md, zIndex: 10}}
        testID="header-left-side"
        onLayout={handleLeftAnchorLayout}
      >
        <TouchableOpacity
          testID="logo-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("Accessibility.LOGO_BUTTON")}
          onPress={onHintPress ?? (() => {})}
          activeOpacity={0.8}
        >
          <LogoIcon width={HEADER_LOGO_SIZE} height={HEADER_LOGO_SIZE} />
        </TouchableOpacity>
      </View>

      {showModeLabel && (
        <View
          className="absolute left-0 right-0 items-center justify-center z-0"
          style={modeLabelContainerStyle}
          testID="header-mode-label-container"
        >
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
              fontSize: TYPOGRAPHY.fontSize.xl,
              color: "#ffffff",
            }}
            testID="header-mode-label"
          >
            {modeLabel}
          </Text>
        </View>
      )}

      {/* Right side: Coins */}
      <View
        ref={localCoinsTargetRef}
        style={{position: "absolute", top: SPACING.md, right: SPACING.md, zIndex: 10}}
        testID="header-right-side"
        onLayout={handleRightAnchorLayout}
      >
        <CoinsDisplay coins={userCoins} onPress={onCoinsPress} shouldAnimateIncreases={shouldAnimateCoins} />
      </View>
    </View>
  );
};

export default React.memo(Header);
