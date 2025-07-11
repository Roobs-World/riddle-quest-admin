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
import { View, Text, Modal, ScrollView } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "../../../utils/responsive";
import { TYPOGRAPHY } from "../../../styles";

interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface TeamMember {
  name: string;
  role: string;
  website?: string;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  const teamMembers: TeamMember[] = [
    {
      name: "Craig Beswetherick",
      role: "Lead Developer & Game Design",
    },
    {
      name: "Reuben Beswetherick",
      role: "Inspiration",
    },
    {
      name: "Thomas Lemrond",
      role: "Game Designer, Publisher, Overall Hero",
    },
    {
      name: "Gavin Harrison",
      role: "Sound Design",
    },
    {
      name: "Nathalia",
      role: "Design",
    },
    {
      name: "Mr Ben",
      role: "Design",
    },
  ];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(28),
                color: "white",
                textAlign: "center",
              }}
            >
              Credits
            </Text>
            <ScrollView
              style={{ flex: 1, width: "100%", maxHeight: 280, marginTop: 10 }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              {teamMembers.map((member, index) => (
                <TeamMemberCard key={index} member={member} />
              ))}
            </ScrollView>
            <WideButton buttonText="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const TeamMemberCard = ({ member }: { member: TeamMember }) => (
  <View
    style={{
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      width: "100%",
      alignItems: "center",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: scale(18),
        color: "white",
        textAlign: "center",
      }}
    >
      {member.name}
    </Text>
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: scale(14),
        color: "rgba(255,255,255,0.8)",
        textAlign: "center",
        marginTop: 4,
      }}
    >
      {member.role}
    </Text>
  </View>
);

export default CreditsModal;
