/**
 * @fileoverview Credits Modal Component
 *
 * An informational modal that displays acknowledgments and attributions for
 * the Qwordly development team and contributors. This modal serves to provide
 * transparency about the project's creators, foster community appreciation,
 * and satisfy attribution requirements for third-party resources.
 *
 * **Key Features:**
 * - Complete team member roster with roles and contributions
 * - Scrollable content for accommodating extensive credits
 * - Professional presentation with consistent branding
 * - Acknowledgment section for special thanks and attributions
 * - Accessibility support for screen readers and navigation
 *
 * **Design Philosophy:**
 * - Clean, professional layout emphasizing respect and recognition
 * - Team member cards with consistent formatting and hierarchy
 * - Smooth scrolling experience for long content lists
 * - Branded background integration maintaining visual consistency
 * - Prominent positioning as full-screen modal for importance
 *
 * **Content Strategy:**
 * - Individual recognition for each team member's contributions
 * - Clear role definitions and responsibilities
 * - Future extensibility for website links and additional details
 * - Gratitude messaging to acknowledge broader community support
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link SettingsModal} For entry point to credits access
 * @see {@link InstructionsModal} For game-related help content
 */

import React from "react";
import { View, Text, Modal, ScrollView, SafeAreaView } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import HomeBgSvg from "../../../../assets/images/home-bg.svg";
import { modalStyles } from "../../../styles/components/modals";
import { COLORS } from "../../../styles/tokens/colors";
import { SPACING } from "../../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../../styles/tokens/borderRadius";
import { scale } from "../../../utils/responsive";

/**
 * Props interface for the CreditsModal component.
 *
 * Defines the required properties for displaying the credits and
 * acknowledgments modal with appropriate navigation controls.
 */
interface CreditsModalProps {
  /** Controls the visibility state of the modal */
  isVisible: boolean;

  /** Callback function executed when user closes the modal */
  onClose: () => void;
}

/**
 * Team Member Information Interface
 *
 * Defines the structure for individual team member data including
 * their name, role, and potential future website/portfolio links.
 */
interface TeamMember {
  /** Full name of the team member */
  name: string;

  /** Role or contribution description */
  role: string;

  /** Optional website or portfolio URL (reserved for future use) */
  website?: string;
}

/**
 * Credits Modal Component
 *
 * A full-screen informational modal that presents the development team
 * and acknowledges all contributors to the Qwordly project. The modal
 * provides a professional and respectful presentation of credits while
 * maintaining the app's visual branding and accessibility standards.
 *
 * **Behavior:**
 * - Displays as full-screen modal with branded background
 * - Provides smooth scrolling for extensive team listings
 * - Includes drag handle for intuitive interaction patterns
 * - Dismisses via close button or primary action button
 * - Maintains focus accessibility for keyboard navigation
 *
 * **Accessibility:**
 * - Screen reader compatible with proper heading hierarchy
 * - High contrast text over background elements
 * - Touch-friendly interactive elements with adequate spacing
 * - Clear navigation and dismissal options
 * - Proper semantic markup for content structure
 *
 * **Styling:**
 * - Full-screen layout with branded background integration
 * - Card-based presentation for individual team members
 * - Consistent typography and spacing throughout
 * - Professional color scheme with appropriate emphasis
 * - Responsive design accommodating various screen sizes
 *
 * @param props - Component props defining modal state and callbacks
 * @returns Rendered credits modal component
 *
 * @example
 * ```tsx
 * <CreditsModal
 *   isVisible={showCreditsModal}
 *   onClose={() => setShowCreditsModal(false)}
 * />
 * ```
 */
const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  /**
   * Development Team Members
   *
   * Comprehensive listing of all individuals who contributed to the
   * Qwordly project, including their specific roles and contributions.
   * Website links are reserved for future implementation.
   */
  const teamMembers: TeamMember[] = [
    {
      name: "Craig Beswetherick",
      role: "Lead Developer & Game Design",
      website: "", // TODO: Add website link
    },
    {
      name: "Reuben Beswetherick",
      role: "Inspiration",
      website: "", // TODO: Add website link
    },
    {
      name: "Thomas Lemrond",
      role: "Game Designer, Publisher, Overall Hero",
      website: "", // TODO: Add website link
    },
    {
      name: "Gavin Harrison",
      role: "Sound Design",
      website: "", // TODO: Add website link
    },
    {
      name: "Nathalia",
      role: "Design",
      website: "", // TODO: Add website link
    },
    {
      name: "Mr Ben",
      role: "Design",
      website: "", // TODO: Add website link
    },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}
      accessibilityLabel="Credits and acknowledgments"
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.backgroundPrimary }}
      >
        <View
          style={{
            backgroundColor: COLORS.backgroundPrimary,
            borderBottomLeftRadius: BORDER_RADIUS.xl,
            borderBottomRightRadius: BORDER_RADIUS.xl,
            flex: 1,
            paddingTop: SPACING.lg,
          }}
        >
          {/* Background Design */}
          <HomeBgSvg
            width="120%"
            height="100%"
            style={{
              position: "absolute",
              top: 0,
              left: -50,
              zIndex: 0,
              opacity: 0.1,
            }}
          />

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

          {/* Close Button */}
          <View
            style={{
              position: "absolute",
              top: SPACING.xl,
              right: SPACING.lg,
              zIndex: 10,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={scale(24)}
              accessibilityLabel="Close credits modal"
            />
          </View>

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
                  fontSize: scale(28),
                  color: COLORS.textPrimary,
                  marginBottom: SPACING.sm,
                },
              ]}
            >
              🎉 Credits
            </Text>
            <Text
              style={[
                modalStyles.subtitle,
                {
                  fontSize: scale(18),
                  color: COLORS.textSecondary,
                  marginBottom: SPACING.xl,
                },
              ]}
            >
              Meet the amazing team behind Qwordly
            </Text>
          </View>

          {/* Scrollable Team Members */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.xl,
              flexGrow: 1,
            }}
            accessibilityLabel="Team members list"
          >
            {teamMembers.map((member, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  marginBottom: SPACING.md,
                  shadowColor: COLORS.shadowColor,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
                accessibilityRole="text"
                accessibilityLabel={`Team member: ${member.name}, ${member.role}`}
              >
                <Text
                  style={{
                    fontSize: scale(20),
                    fontWeight: "bold",
                    color: COLORS.textPrimary,
                    textAlign: "center",
                    marginBottom: SPACING.sm,
                  }}
                >
                  {member.name}
                </Text>
                <Text
                  style={{
                    fontSize: scale(16),
                    color: COLORS.textSecondary,
                    textAlign: "center",
                    lineHeight: scale(22),
                  }}
                >
                  {member.role}
                </Text>
              </View>
            ))}

            {/* Thank You Section */}
            <View
              style={{
                marginTop: SPACING.xl,
                padding: SPACING.lg,
                backgroundColor: "rgba(255, 140, 0, 0.1)",
                borderRadius: BORDER_RADIUS.lg,
                borderWidth: 1,
                borderColor: COLORS.primaryOrangeLight,
              }}
            >
              <Text
                style={{
                  fontSize: scale(22),
                  fontWeight: "bold",
                  color: COLORS.textPrimary,
                  textAlign: "center",
                  marginBottom: SPACING.md,
                }}
              >
                🙏 Thank You!
              </Text>
              <Text
                style={{
                  fontSize: scale(16),
                  color: COLORS.textSecondary,
                  textAlign: "center",
                  lineHeight: scale(24),
                }}
              >
                Special thanks to all our contributors who made Qwordly
                possible. Your creativity, dedication, and passion brought this
                project to life.
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View
            style={{
              paddingHorizontal: SPACING.lg,
              paddingBottom: SPACING.lg,
              paddingTop: SPACING.md,
              backgroundColor: COLORS.backgroundPrimary,
            }}
          >
            <WideButton buttonText="Got It!" onPress={onClose} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default CreditsModal;
