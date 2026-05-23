/**
 * @fileoverview Credits Modal Component
 */

import React from "react";
import {View, Text, Modal, FlatList, StyleSheet, Linking, Pressable} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  CLOSE_BUTTON_SIZE,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {verticalScale} from "../../../utils/responsive";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";

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
  {name: "Craig Beswetherick", role: "Lead Developer & Game Design", website: "https://www.roobsworld.com"},
  {name: "Reuben Beswetherick", role: "Inspiration", website: "https://www.roobsworld.com"},
  {name: "Mike Hawkyard", role: "Game Designer, Publisher, Overall Hero"},
  {name: "Gavin Harrison", role: "Sound Design"},
  {name: "Nathalia", role: "Design"},
  {name: "Mr Ben", role: "Design"},
];

const renderTeamMember = ({item}: {item: TeamMember}) => <TeamMemberCard member={item} />;

const keyExtractor = (item: TeamMember) => item.name;

const CREDITS_MODAL_HEIGHT = Math.min(MODAL_HEIGHT * 1.2, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.2);

const CreditsModal: React.FC<CreditsModalProps> = ({isVisible, onClose, topRightControl}) => {
  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={onClose}>
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
        <RotatingWheelBackground isVisible={isVisible} />
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: CREDITS_MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={CREDITS_MODAL_HEIGHT * 1.05}
              style={{position: "absolute", top: -CREDITS_MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                padding: MODAL_CONTENT_PADDING,
                paddingTop: verticalScale(40),
                paddingBottom: verticalScale(30),
              }}
            >
              <CloseButton
                onPress={onClose}
                size={CLOSE_BUTTON_SIZE}
                style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(28)}}
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
                contentContainerStyle={{alignItems: "center"}}
              />
              <WideButton buttonText={AppStrings.CommonAlerts.CLOSE_BUTTON} onPress={onClose} />
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

const TeamMemberCard = ({member}: {member: TeamMember}) => {
  const handlePress = () => {
    if (member.website) {
      void Linking.openURL(member.website);
    }
  };

  const cardContent = (
    <>
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
    </>
  );

  if (member.website) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel={`${member.name} website`}
        style={{
          borderRadius: CARD_BORDER_RADIUS,
          padding: CARD_PADDING,
          marginBottom: CARD_MARGIN_BOTTOM,
          width: "100%",
          alignItems: "center",
        }}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        borderRadius: CARD_BORDER_RADIUS,
        padding: CARD_PADDING,
        marginBottom: CARD_MARGIN_BOTTOM,
        width: "100%",
        alignItems: "center",
      }}
    >
      {cardContent}
    </View>
  );
};

export default CreditsModal;
