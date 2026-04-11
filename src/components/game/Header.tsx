/**
 * @fileoverview
 * Game header component showing the Qwordly logo, coin balance, and mode label.
 *
 * This header is used at the top of the main `GameScreen` and is responsible
 * for providing quick access to the coin shop and surfacing current mode context.
 */
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, View, TouchableOpacity, Text } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LogoIcon from "../icons/LogoIcon";
import { TYPOGRAPHY, SPACING } from "../../styles";
import { HEADER_LOGO_SIZE } from "../../constants/layout";

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
  /** Optional mode label (e.g. "Daily Challenge"). */
  modeLabel?: string;
}

/**
 * Header component for the main game screen.
 *
 * Renders the Qwordly logo, current coin balance, and an optional centered
 * mode label. Callers are expected to wire `onCoinsPress` to open the coin
 * shop and may use `onHintPress` for future logo interactions.
 *
 * @param props Props controlling coin display and optional mode label.
 */
const Header: React.FC<HeaderProps> = ({
  userCoins,
  onCoinsPress,
  modeLabel,
}) => {
  const showModeLabel = !!modeLabel;
  const [headerWidth, setHeaderWidth] = useState(0);
  const [leftAnchor, setLeftAnchor] = useState({ x: SPACING.md, width: HEADER_LOGO_SIZE });
  const [rightAnchor, setRightAnchor] = useState({ x: 0, width: 0 });
  const layoutRecalcKey = `${userCoins}-${modeLabel ?? ""}`;

  const modeLabelContainerStyle = useMemo(() => {
    const leftBoundary = leftAnchor.x + leftAnchor.width;
    const rightBoundary = rightAnchor.x;
    const rightInset = headerWidth > 0 ? Math.max(0, headerWidth - rightBoundary) : SPACING.md;

    // Center the label within the live space between logo and coins so it never overlaps either side.
    if (headerWidth > 0 && rightBoundary > leftBoundary) {
      return { top: 0, bottom: 0, left: leftBoundary, right: rightInset, transform: [{ translateY: 4 }] };
    }

    // Safe fallback before first layout pass.
    return { top: 0, bottom: 0, left: SPACING.xl, right: SPACING.xl, transform: [{ translateY: 4 }] };
  }, [headerWidth, leftAnchor, rightAnchor]);

  const handleHeaderLayout = (event: LayoutChangeEvent) => {
    setHeaderWidth(event.nativeEvent.layout.width);
  };

  const handleLeftAnchorLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLeftAnchor({ x, width });
  };

  const handleRightAnchorLayout = (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setRightAnchor({ x, width });
  };

  return (
    <View
      className="w-full flex-row items-center justify-between relative"
      style={{
        minHeight: "8%",
        maxHeight: "8%",
        height: "8%",
        paddingHorizontal: SPACING.md,
      }}
      testID="header"
      onLayout={handleHeaderLayout}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Game header with logo and coin balance"
    >
      {/* Logo Icon in top-left corner - positioned absolutely like CloseButton */}
      <View
        style={{ position: "absolute", top: SPACING.md, left: SPACING.md, zIndex: 10 }}
        testID="header-left-side"
        onLayout={handleLeftAnchorLayout}
      >
        <LogoIcon width={HEADER_LOGO_SIZE} height={HEADER_LOGO_SIZE} color="#ffffff" />
      </View>

      {showModeLabel && (
        <View
          key={`mode-label-${layoutRecalcKey}`}
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
        key={`coins-anchor-${layoutRecalcKey}`}
        style={{ position: "absolute", top: SPACING.md, right: SPACING.md, zIndex: 10 }}
        testID="header-right-side"
        onLayout={handleRightAnchorLayout}
      >
        <CoinsDisplay coins={userCoins} onPress={onCoinsPress} />
      </View>
    </View>
  );
};

export default React.memo(Header);