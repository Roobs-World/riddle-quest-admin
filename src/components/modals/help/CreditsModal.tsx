/**
 * @fileoverview Credits Modal Component
 */

import React from "react";
import { View, Text, Modal, FlatList, StyleSheet } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import { TYPOGRAPHY } from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  CLOSE_BUTTON_SIZE,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";
import { dimensions, verticalScale } from "../../../utils/responsive";
import { AppStrings } from "../../../constants/AppStrings";

interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
  topRightControl?: React.ReactNode;
}

interface TeamMember {
  name: string;
  role: string;
  website?: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: "Craig Beswetherick", role: "Lead Developer & Game Design" },
  { name: "Reuben Beswetherick", role: "Inspiration" },
  { name: "Thomas Lemrond", role: "Game Designer, Publisher, Overall Hero" },
  { name: "Gavin Harrison", role: "Sound Design" },
  { name: "Nathalia", role: "Design" },
  { name: "Mr Ben", role: "Design" },
];

const renderTeamMember = ({ item }: { item: TeamMember }) => (
  <TeamMemberCard member={item} />
);

const keyExtractor = (item: TeamMember) => item.name;

const CREDITS_MODAL_HEIGHT = Math.min(
  MODAL_HEIGHT * 1.2,
  dimensions.screenHeight * 0.9
);

const CreditsModal: React.FC<CreditsModalProps> = ({
  isVisible,
  onClose,
  topRightControl,
}) => {

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
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        {topRightControl ? (
          <View
            style={{
              position: "absolute",
              top: SPACING.md,
              right: SPACING.md,
              zIndex: 1000,
            }}
          >
            {topRightControl}
          </View>
        ) : null}

        <View
          style={{
            width: MODAL_WIDTH,
            height: CREDITS_MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >

          <ModalBg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill]}
            preserveAspectRatio="none"
          />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />

          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: MODAL_CONTENT_PADDING,
              paddingTop: verticalScale(40),
              paddingBottom: verticalScale(30)
            }}
          >
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={MODAL_CLOSE_BUTTON_POSITION}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: "black",
                textAlign: "center",
              }}
            >
              {AppStrings.Credits.TITLE}
            </Text>
            <FlatList
              data={TEAM_MEMBERS}
              renderItem={renderTeamMember}
              keyExtractor={keyExtractor}
              style={{
                flex: 1,
                width: "100%",
                marginTop: SPACING.sm,
              }}
              contentContainerStyle={{ alignItems: "center" }}
            />
            <WideButton buttonText={AppStrings.CommonAlerts.CLOSE_BUTTON} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const TeamMemberCard = ({ member }: { member: TeamMember }) => (
  <View
    style={{
      borderRadius: CARD_BORDER_RADIUS,
      padding: CARD_PADDING,
      marginBottom: CARD_MARGIN_BOTTOM,
      width: "100%",
      alignItems: "center",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: TYPOGRAPHY.fontSize.lg,
        color: "black",
        textAlign: "center",
      }}
    >
      {member.name}
    </Text>
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.sm,
        color: "rgba(0,0,0,0.6)",
        textAlign: "center",
        marginTop: SPACING.xs,
      }}
    >
      {member.role}
    </Text>
  </View>
);

export default CreditsModal;
