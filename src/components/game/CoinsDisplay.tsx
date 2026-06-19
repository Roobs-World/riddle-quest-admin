/**
 * @fileoverview CoinsDisplay component for showing player's coin balance in Riddle Quest.
 *
 * This component displays the player's current coin balance with a custom SVG
 * coin icon. It supports both read-only display and interactive modes that
 * open the coin shop when tapped. The component includes proper accessibility
 * support and visual feedback for user interactions.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import React, {useEffect, useRef, useState} from "react";
import {Text, TouchableOpacity, Animated, Easing} from "react-native";
import {SvgXml} from "react-native-svg";
import {COIN_DISPLAY_ICON_SIZE} from "../../constants/layout";
import {TYPOGRAPHY, SPACING} from "../../styles";

/**
 * Embedded SVG icon for the coin display.
 *
 * This SVG represents a stack of gold coins with shadows and highlights
 * to create a 3D effect. The icon uses the app's primary orange color
 * scheme and includes decorative plus symbols around the coins.
 *
 * Visual features:
 * - Multiple coin layers for depth perception
 * - Gold/orange gradient coloring
 * - 3D shading and highlights
 * - Decorative plus symbols
 * - Optimized for 24x24 to 48x48 pixel display
 */
const coinSvg = `<svg width="24" height="24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M24.6523 84.8488C24.6523 75.8092 45.1995 68.4873 70.5531 68.4873C95.9066 68.4873 116.461 75.8089 116.461 84.8488V99.8809C116.461 108.921 95.9066 116.242 70.5531 116.242C45.1995 116.242 24.6523 108.921 24.6523 99.8809C24.6523 94.8702 24.6523 89.8595 24.6523 84.8488Z" fill="#FE9923"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5531 68.4873C95.9063 68.4873 116.461 75.8089 116.461 84.8488C116.461 93.8816 95.9066 101.21 70.5531 101.21C45.1995 101.21 24.6523 93.8818 24.6523 84.8488C24.6523 75.8092 45.1995 68.4873 70.5531 68.4873Z" fill="#FECD3D"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5528 68.4873C78.2698 68.4873 85.5439 69.1623 91.925 70.3621V71.4461C91.925 80.4857 71.371 87.8075 46.0243 87.8075C38.348 87.8075 31.115 87.1396 24.7545 85.9532C24.6863 85.5852 24.6523 85.217 24.6523 84.8488C24.6521 75.8092 45.1993 68.4873 70.5528 68.4873Z" fill="#CEA732"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5533 76.1299C90.7255 76.1299 107.073 80.0362 107.073 84.8491C107.073 89.6622 90.7255 93.5615 70.5533 93.5615C50.3879 93.5615 34.0332 89.662 34.0332 84.8491C34.0332 80.0362 50.3877 76.1299 70.5533 76.1299Z" fill="#FEA832"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5533 76.1299C77.2341 76.1299 83.4992 76.5595 88.8917 77.3093C82.2723 83.4515 65.5768 87.8078 46.0248 87.8078C42.4388 87.8078 38.9553 87.6646 35.608 87.3853C34.5854 86.5809 34.0332 85.7287 34.0332 84.8493C34.0332 80.0362 50.3877 76.1299 70.5533 76.1299Z" fill="#CE8829"/>
<path d="M104.046 103.064V111.068C105.457 110.529 106.773 109.963 107.973 109.357V103.058L104.046 103.064ZM93.786 113.993C92.518 114.258 91.2091 114.504 89.8661 114.729V107.101L93.786 107.107V113.993ZM79.6061 115.922C78.3177 116.017 77.0087 116.085 75.6862 116.14V108.859L79.6061 108.873V115.922ZM65.4262 116.14C64.0968 116.085 62.7878 116.017 61.4995 115.922V108.866H65.4262V116.14ZM51.2395 114.729C49.8965 114.504 48.5875 114.258 47.3195 113.992V107.1L51.2395 107.107V114.729ZM37.0595 111.068C35.6484 110.529 34.3326 109.964 33.1328 109.357V103.065L37.0595 103.058V111.068Z" fill="#C85929"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M0.117188 52.4874C0.117188 43.4478 20.6712 36.1191 46.0247 36.1191C71.3712 36.1191 91.9254 43.4478 91.9254 52.4874V67.5195C91.9254 76.5523 71.3714 83.881 46.0247 83.881C20.6712 83.881 0.117188 76.5523 0.117188 67.5195C0.117188 62.5088 0.117188 57.4981 0.117188 52.4874Z" fill="#FE9923"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M46.0247 36.1191C71.3712 36.1191 91.9254 43.4478 91.9254 52.4874C91.9254 61.5202 71.3714 68.8487 46.0247 68.8487C20.6712 68.8489 0.117188 61.5205 0.117188 52.4874C0.117188 43.4478 20.6712 36.1191 46.0247 36.1191Z" fill="#FECD3D"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M46.0248 36.1191C71.3713 36.1191 91.9255 43.4478 91.9255 52.4874C91.9255 53.3736 91.7277 54.2462 91.3394 55.0984C86.4923 55.6505 81.3248 55.9437 75.9597 55.9437C47.9748 55.9437 25.2871 47.8585 25.2871 37.8849C31.5109 36.7599 38.5598 36.1191 46.0248 36.1191Z" fill="#CEA732"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M46.024 43.7686C66.1894 43.7686 82.5441 47.6749 82.5441 52.4878C82.5441 57.3007 66.1894 61.2002 46.024 61.2002C25.8518 61.2002 9.50391 57.3007 9.50391 52.4878C9.50391 47.6749 25.8516 43.7686 46.024 43.7686Z" fill="#FEA832"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M46.0239 43.7686C66.1893 43.7686 82.544 47.6749 82.544 52.4878C82.544 53.6943 81.5078 54.8533 79.633 55.8963C78.4197 55.9305 77.1925 55.9441 75.9585 55.9441C54.8045 55.9441 36.6843 51.3288 29.0898 44.7637C34.1549 44.1297 39.9088 43.7686 46.0239 43.7686Z" fill="#CE8829"/>
<path d="M79.5177 70.7031V78.7065C80.9288 78.1679 82.2446 77.5954 83.4444 76.9954V70.6963L79.5177 70.7031ZM69.2577 81.6311C67.9897 81.8968 66.6807 82.1425 65.3377 82.3672V74.7388L69.2577 74.7456V81.6311ZM55.0709 83.5604C53.7826 83.6558 52.4804 83.724 51.151 83.7786V76.4978L55.0709 76.5046V83.5604ZM40.891 83.7784C39.5684 83.7238 38.2595 83.6556 36.9643 83.5602V76.5046L40.891 76.4978V83.7784ZM26.7043 82.3672C25.3613 82.1422 24.0591 81.8968 22.7844 81.6311V74.7388L26.7043 74.7456V82.3672ZM12.5312 78.7065C11.1132 78.1679 9.80422 77.5954 8.59766 76.9954V70.7031L12.5312 70.6963V78.7065Z" fill="#C85929"/>
<path d="M116.366 55.0576V58.5821H119.884V61.9499H116.366V65.4676H112.998V61.9499H109.48V58.5821H112.998V55.0576H116.366Z" fill="#FEA832"/>
<path d="M10.8005 90.8076V94.3254H14.3182V97.6931H10.8005V101.211H7.43273V97.6931H3.9082V94.3254H7.43273V90.8076H10.8005Z" fill="#FEA832"/>
<path d="M10.8005 17.2148V20.7326H14.3182V24.1003H10.8005V27.6248H7.43273V24.1003H3.9082V20.7326H7.43273V17.2148H10.8005Z" fill="#FEA832"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M24.6523 20.1193C24.6523 11.0865 45.1995 3.75781 70.5531 3.75781C95.9066 3.75781 116.461 11.0863 116.461 20.1193V35.1582C116.461 44.191 95.9066 51.5197 70.5531 51.5197C45.1995 51.5197 24.6523 44.1912 24.6523 35.1582C24.6523 30.1475 24.6523 25.13 24.6523 20.1193Z" fill="#FE9923"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5531 3.75781C95.9063 3.75781 116.461 11.0863 116.461 20.1193C116.461 29.1589 95.9066 36.4876 70.5531 36.4876C45.1995 36.4876 24.6523 29.1589 24.6523 20.1193C24.6523 11.0865 45.1995 3.75781 70.5531 3.75781Z" fill="#FECD3D"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M70.5533 11.4072C90.7255 11.4072 107.073 15.3068 107.073 20.1196C107.073 24.9396 90.7255 28.8389 70.5533 28.8389C50.3879 28.8389 34.0332 24.9393 34.0332 20.1196C34.0332 15.3068 50.3877 11.4072 70.5533 11.4072Z" fill="#FEA832"/>
<path d="M104.046 38.3418V46.3452C105.457 45.8066 106.773 45.234 107.973 44.634V38.335L104.046 38.3418ZM93.786 49.2697C92.518 49.5355 91.2091 49.7811 89.8661 49.9991V42.3775L93.786 42.3843V49.2697ZM79.6061 51.1991C78.3177 51.2877 77.0087 51.3627 75.6862 51.4173V44.1364L79.6061 44.1432V51.1991ZM65.4262 51.4173C64.0968 51.3627 62.7878 51.2877 61.4995 51.1991V44.1432L65.4262 44.1364V51.4173ZM51.2395 49.9991C49.8965 49.7809 48.5875 49.5355 47.3195 49.2697V42.3775L51.2395 42.3843V49.9991ZM37.0595 46.3452C35.6484 45.8066 34.3326 45.234 33.1328 44.634V38.3418L37.0595 38.335V46.3452Z" fill="#C85929"/>
</svg>`;

const CoinIcon = React.memo(() => (
  <SvgXml xml={coinSvg} width={COIN_DISPLAY_ICON_SIZE} height={COIN_DISPLAY_ICON_SIZE} testID="coin-icon" />
));

CoinIcon.displayName = "CoinIcon";
const COIN_TEXT_UPDATE_INTERVAL_MS = 33;

/**
 * Props interface for the CoinsDisplay component.
 *
 * @property {number} coins - Current coin balance to display
 * @property {() => void} [onPress] - Optional callback when component is tapped
 */
interface CoinsDisplayProps {
  /** The number of coins to display (non-negative integer) */
  coins: number;

  /**
   * Optional function to call when the coins are pressed.
   * If provided, makes the component interactive and typically opens the coin shop.
   */
  onPress?: () => void;

  /**
   * Controls whether positive coin-change animations are allowed to run.
   * When false, coin increases are deferred until this becomes true.
   */
  shouldAnimateIncreases?: boolean;
}

/**
 * CoinsDisplay Component
 *
 * A component that displays the player's current coin balance with an attractive
 * coin icon. Supports both read-only display and interactive modes for accessing
 * the coin shop. The component provides proper accessibility support and visual
 * feedback for user interactions.
 *
 * Visual Design:
 * - Custom SVG coin icon with 3D appearance
 * - Bold typography for coin count
 * - Horizontal layout with icon and number
 * - Consistent spacing and alignment
 *
 * Interaction Modes:
 * - Read-only: Displays coin balance without interaction
 * - Interactive: Tappable area that triggers onPress callback
 * - Accessibility: Proper labels and roles for screen readers
 *
 * Features:
 * - Animated SVG coin icon with gradient coloring
 * - Proper pluralization (coin vs coins)
 * - Touch feedback when interactive
 * - Test ID support for automated testing
 * - Comprehensive accessibility labeling
 * - Responsive sizing for different screen sizes
 *
 * Usage Examples:
 * ```tsx
 * // Read-only coin display
 * <CoinsDisplay coins={150} />
 *
 * // Interactive coin display that opens shop
 * <CoinsDisplay coins={42} onPress={openCoinShop} />
 *
 * // In a header or status bar
 * <View className="flex-row justify-between">
 *   <ScreenTitle title="Game" />
 *   <CoinsDisplay coins={playerCoins} onPress={handleShopOpen} />
 * </View>
 * ```
 *
 * @param {CoinsDisplayProps} props - Component props
 * @returns {JSX.Element} Rendered coin display component
 */
const CoinsDisplay: React.FC<CoinsDisplayProps> = ({coins, onPress, shouldAnimateIncreases = true}) => {
  const normalizedCoins = typeof coins === "number" && Number.isFinite(coins) ? coins : 0;
  const [displayedCoinsAnimatedValue] = useState(() => new Animated.Value(normalizedCoins));
  const [scaleAnimatedValue] = useState(() => new Animated.Value(1));
  const previousCoinsRef = useRef(normalizedCoins);
  const displayedCoinsRef = useRef(normalizedCoins);
  const isCountUpAnimationRunningRef = useRef(false);
  const lastAnimatedTextUpdateAtRef = useRef(0);
  const [displayedCoins, setDisplayedCoins] = useState(normalizedCoins);

  useEffect(() => {
    const listenerId = displayedCoinsAnimatedValue.addListener(({value}) => {
      const roundedValue = Math.round(value);
      if (roundedValue === displayedCoinsRef.current) {
        return;
      }

      if (isCountUpAnimationRunningRef.current) {
        const now = Date.now();
        if (now - lastAnimatedTextUpdateAtRef.current < COIN_TEXT_UPDATE_INTERVAL_MS) {
          return;
        }
        lastAnimatedTextUpdateAtRef.current = now;
      }

      displayedCoinsRef.current = roundedValue;
      setDisplayedCoins(roundedValue);
    });

    return () => {
      displayedCoinsAnimatedValue.removeListener(listenerId);
    };
  }, [displayedCoinsAnimatedValue]);

  useEffect(() => {
    const previousCoins = previousCoinsRef.current;
    const coinsAdded = normalizedCoins - previousCoins;

    displayedCoinsAnimatedValue.stopAnimation();
    scaleAnimatedValue.stopAnimation();

    const isCountUpAnimationNeeded = coinsAdded > 0;
    const isTestEnvironment = process.env.NODE_ENV === "test";
    const canRunCountUpAnimation = shouldAnimateIncreases && !isTestEnvironment;

    if (!shouldAnimateIncreases && isCountUpAnimationNeeded) {
      // Keep the old value in view while modals are open so we can animate to the
      // new total once all overlays are dismissed.
      isCountUpAnimationRunningRef.current = false;
      displayedCoinsAnimatedValue.setValue(previousCoins);
      scaleAnimatedValue.setValue(1);
      displayedCoinsRef.current = previousCoins;
      setDisplayedCoins(previousCoins);
      return;
    }

    previousCoinsRef.current = normalizedCoins;

    if (!isCountUpAnimationNeeded || !canRunCountUpAnimation) {
      isCountUpAnimationRunningRef.current = false;
      displayedCoinsAnimatedValue.setValue(normalizedCoins);
      scaleAnimatedValue.setValue(1);
      displayedCoinsRef.current = normalizedCoins;
      setDisplayedCoins(normalizedCoins);
      return;
    }

    const coinCountUpDurationMs = Math.min(2500, 400 + Math.sqrt(coinsAdded) * 180);
    isCountUpAnimationRunningRef.current = true;
    lastAnimatedTextUpdateAtRef.current = 0;
    displayedCoinsAnimatedValue.setValue(previousCoins);

    Animated.timing(displayedCoinsAnimatedValue, {
      toValue: normalizedCoins,
      duration: coinCountUpDurationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({finished}) => {
      isCountUpAnimationRunningRef.current = false;

      if (!finished) {
        return;
      }

      displayedCoinsRef.current = normalizedCoins;
      setDisplayedCoins(normalizedCoins);

      Animated.sequence([
        Animated.timing(scaleAnimatedValue, {
          toValue: 1.15,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimatedValue, {
          toValue: 1,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [normalizedCoins, shouldAnimateIncreases, displayedCoinsAnimatedValue, scaleAnimatedValue]);

  /** Generate appropriate text for singular/plural coin count */
  const coinText = normalizedCoins === 1 ? "coin" : "coins";

  /** Accessibility label for read-only mode */
  const accessibilityLabel = `You have ${normalizedCoins} ${coinText}`;

  /** Accessibility label for interactive mode */
  const touchableAccessibilityLabel = `Open coin shop. ${accessibilityLabel}`;

  /**
   * Core content component showing coin icon and count.
   * This is rendered the same way regardless of interaction mode.
   */
  const content = (
    <Animated.View
      className="flex-row items-center"
      testID="coins-display"
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      style={{transform: [{scale: scaleAnimatedValue}]}}
    >
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontPrimary,
          color: "#ffffff",
          fontSize: TYPOGRAPHY.fontSize.lg,
          marginRight: SPACING.sm,
        }}
      >
        {String(displayedCoins)}
      </Text>
      <CoinIcon />
    </Animated.View>
  );

  /**
   * Interactive Mode Rendering
   *
   * When onPress is provided, wraps the content in a TouchableOpacity
   * to enable tap interactions (typically for opening the coin shop).
   */
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center"
        testID="coins-display-touchable"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={touchableAccessibilityLabel}
      >
        {content}
      </TouchableOpacity>
    );
  }

  /**
   * Read-Only Mode Rendering
   *
   * When no onPress is provided, returns the content directly
   * for display-only purposes.
   */
  return content;
};

export default CoinsDisplay;
