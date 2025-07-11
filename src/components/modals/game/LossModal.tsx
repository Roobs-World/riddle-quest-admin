/**
 * @fileoverview Loss Modal Component
 *
 * A feedback modal that appears when a player fails to solve a riddle within
 * the allowed attempts. This modal provides closure by revealing the correct
 * answer, offers emotional support through encouraging messaging, and presents
 * clear options for continuing their gaming session.
 *
 * **Key Features:**
 * - Clear loss state communication with supportive messaging
 * - Correct answer revelation for learning and closure
 * - Immediate next level option to encourage continued engagement
 * - Alternative navigation to main menu for session management
 * - Accessibility support for all interaction elements
 *
 * **Psychology & UX:**
 * - Minimizes frustration by immediately showing the answer
 * - Provides learning opportunity through answer revelation
 * - Encourages immediate re-engagement with prominent next level option
 * - Offers graceful exit without penalty or shame
 * - Uses supportive rather than punitive language and design
 *
 * **Design Patterns:**
 * - Error modal variant with red accent color
 * - Information-focused layout prioritizing answer display
 * - Clear action hierarchy (next level primary, home secondary)
 * - Consistent modal structure and responsive design
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link VictoryModal} For success state counterpart
 * @see {@link OutOfAttemptsModal} For attempt exhaustion handling
 */

import React, { useEffect } from "react";
import { View, Text, Modal, SafeAreaView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../../styles/tokens/borderRadius";
import { scale } from "../../../utils/responsive";
import WheelBgSvg from "../../../../assets/images/wheel-bg.svg";
import SegmentBgSvg from "../../../../assets/images/segment-bg.svg";
import { TYPOGRAPHY } from "../../../styles";
import WideButton from "../../buttons/WideButton";

/**
 * Props interface for the LossModal component.
 *
 * Defines all required properties for rendering the loss state modal
 * with appropriate answer display and navigation options.
 */
interface LossModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** The correct answer to display for player learning */
  correctAnswer: string;

  /** Callback function executed when user chooses to go to the next level */
  onNextLevel: () => void;

  /** Callback function executed when user chooses to return to main menu */
  onHome: () => void;

  /** Function to close the modal (from BaseModalProps) */
  onClose?: () => void;
}

/**
 * Loss Modal Component
 *
 * Displays when a player fails to solve a riddle, providing the correct answer
 * and options for next steps. The modal focuses on learning and encouragement
 * rather than punishment, helping maintain player engagement and motivation.
 *
 * **Behavior:**
 * - Appears immediately after final incorrect guess
 * - Reveals the correct answer for educational value
 * - Provides immediate next level option for re-engagement
 * - Allows navigation back to main menu
 * - Dismisses upon any action selection
 *
 * **Accessibility:**
 * - Screen reader compatible with clear state communication
 * - High contrast colors for text and background elements
 * - Touch-friendly button sizes and spacing
 * - Clear labeling of all interactive elements
 *
 * **Styling:**
 * - Error modal variant with red accent color
 * - Prominent correct answer display for learning
 * - Primary next level button for immediate re-engagement
 * - Secondary home button for session management
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered loss modal component
 *
 * @example
 * ```tsx
 * <LossModal
 *   isVisible={showLossModal}
 *   correctAnswer="rainbow"
 *   onNextLevel={() => {
 *     loadNextLevel();
 *     setShowLossModal(false);
 *   }}
 *   onHome={() => {
 *     navigateToHome();
 *     setShowLossModal(false);
 *   }}
 * />
 * ```
 */
const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onNextLevel,
  onHome,
  onClose,
}) => {
  /**
   * Rotation animation for the wheel background
   */
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Start rotation animation when modal becomes visible
      rotation.value = 0; // Reset to 0 first
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 10000, // 10 seconds for one full rotation (faster)
          easing: Easing.linear,
        }),
        -1, // Infinite repetition
        false // Don't reverse
      );
    } else {
      // Reset rotation when modal is hidden
      rotation.value = 0;
    }
  }, [isVisible, rotation]);

  const animatedWheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  /**
   * Handle next level button press
   * This ensures both the onNextLevel callback is called and the modal is closed
   */
  const handleNextLevel = async () => {
    console.log("Next Level button pressed in LossModal");
    console.log("onNextLevel type:", typeof onNextLevel);
    console.log("onClose type:", typeof onClose);

    // First call onNextLevel if it exists
    if (typeof onNextLevel === "function") {
      console.log("Calling onNextLevel");
      try {
        // Handle both async and non-async onNextLevel functions
        await Promise.resolve(onNextLevel());
        console.log("onNextLevel called successfully");
      } catch (error) {
        console.error("Error calling onNextLevel:", error);

        // Even if onNextLevel fails, still try to close the modal
        console.log("Attempting to close modal after onNextLevel error");
      }
    } else {
      console.warn("onNextLevel is not a function or is undefined");

      // Special handling for debug mode - just close the modal
      console.log("In debug mode or missing callback - just closing modal");
    }

    // Then close the modal
    if (typeof onClose === "function") {
      console.log("Calling onClose");
      try {
        onClose();
        console.log("onClose called successfully");
      } catch (error) {
        console.error("Error calling onClose:", error);
        console.log("Modal may remain open due to onClose error");
      }
    } else {
      console.warn("onClose is not a function or is undefined");
      console.log("Cannot close modal - onClose callback is missing");
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={() => {
        onHome();
      }}
      accessibilityLabel="Game loss notification with correct answer"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <View
          style={{
            backgroundColor: "transparent",
            borderBottomLeftRadius: BORDER_RADIUS.xl,
            borderBottomRightRadius: BORDER_RADIUS.xl,
            flex: 1,
            paddingTop: SPACING.lg,
          }}
        >
          {/* Background Design */}
          <View
            style={{
              position: "absolute",
              top: -150,
              left: -150,
              right: -150,
              bottom: -150,
              zIndex: 0,
              justifyContent: "center",
              alignItems: "center",
              opacity: 0.4,
            }}
          >
            <Animated.View
              style={[
                animatedWheelStyle,
                {
                  width: 1000,
                  height: 1000,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <WheelBgSvg width={1000} height={1000} />
            </Animated.View>
          </View>

          {/* Drag Handle */}
          <View
            style={{
              alignSelf: "center",
              width: scale(40),
              height: scale(4),
              backgroundColor: COLORS.gray300,
              borderRadius: BORDER_RADIUS.sm,
              marginBottom: SPACING.lg,
            }}
          />

          {/* Header */}
          <View
            style={[
              modalStyles.headerCentered,
              { paddingHorizontal: SPACING.lg },
            ]}
          >
            <Text
              style={[
                modalStyles.title,
                {
                  fontSize: scale(48),
                  color: COLORS.error,
                  fontFamily: TYPOGRAPHY.fontPrimary,
                },
              ]}
            >
              Try Again!
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                {
                  fontSize: scale(24),
                  color: COLORS.textSecondary,
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  marginTop: SPACING.md,
                },
              ]}
            >
              Don&apos;t worry, every puzzle is a learning opportunity!
            </Text>
          </View>

          {/* Content Container */}
          <View
            style={{
              flex: 1,
              paddingHorizontal: SPACING.lg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Middle Section with Treasure Chest */}
            <View
              style={{
                alignItems: "center",
                width: "100%",
                position: "relative",
              }}
            >
              {/* Treasure Chest with Overlaid Text */}
              <View
                style={{
                  position: "absolute",
                  alignItems: "center",
                  top: -160,
                }}
              >
                <SegmentBgSvg width={scale(320)} height={scale(240)} />

                {/* Overlaid Answer Text */}
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {/* Semi-transparent background for better text visibility */}
                  <View
                    style={{
                      paddingHorizontal: scale(16),
                      paddingVertical: scale(8),
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: scale(18),
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        color: "black",
                        textAlign: "center",
                      }}
                    >
                      The correct answer was:
                    </Text>
                    <Text
                      style={{
                        fontSize: scale(32),
                        color: COLORS.primaryOrange,
                        textAlign: "center",
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                      }}
                    >
                      {correctAnswer}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.lg,
              backgroundColor: "transparent",
              gap: SPACING.sm,
            }}
          >
            <WideButton
              buttonText="Next Level"
              onPress={handleNextLevel}
              buttonColor="bg-orange-500"
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LossModal;
