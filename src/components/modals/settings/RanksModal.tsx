import React from "react";
import {Modal, ScrollView, Text, View} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {PLAYER_RANKS, getRankForLevel} from "../../../constants/ranks";
import {
  CARD_BORDER_RADIUS,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
  MODAL_CONTENT_PADDING,
  MODAL_HEIGHT,
  MODAL_MAX_HEIGHT,
  MODAL_SCROLLABLE_MAX_HEIGHT,
  MODAL_WIDTH,
} from "../../../constants/layout";
import {t} from "../../../i18n";
import {COLORS, SPACING, TYPOGRAPHY} from "../../../styles";
import {verticalScale} from "../../../utils/responsive";
import CloseButton from "../../buttons/CloseButton";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface RanksModalProps {
  isVisible: boolean;
  currentLevel: number;
  onClose: () => void;
}

const RanksModal: React.FC<RanksModalProps> = ({isVisible, currentLevel, onClose}) => {
  const currentRank = getRankForLevel(currentLevel);
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityLabel={t("Ranks.TITLE")}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            testID="ranks-modal-card"
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={modalHeight} style={{position: "absolute"}} />
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={modalHeight * 1.1}
              style={{position: "absolute", top: -modalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(14)}}
            />
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: COLORS.black,
                marginTop: SPACING["2xl"],
              }}
            >
              {t("Ranks.TITLE")}
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: "rgba(0,0,0,0.7)",
                textAlign: "center",
                marginTop: SPACING.xs,
                marginBottom: SPACING.md,
                paddingHorizontal: MODAL_CONTENT_PADDING,
              }}
            >
              {t("Ranks.SUBTITLE")}
            </Text>
            <ScrollView
              testID="ranks-list"
              style={{width: "100%", maxHeight: Math.min(MODAL_SCROLLABLE_MAX_HEIGHT, modalHeight * 0.76)}}
              contentContainerStyle={{
                paddingHorizontal: MODAL_CONTENT_PADDING,
                paddingBottom: SPACING.lg,
              }}
              showsVerticalScrollIndicator={false}
            >
              {PLAYER_RANKS.map((rank) => {
                const isCurrent = rank.id === currentRank.id;
                const isUnlocked = currentLevel >= rank.minimumLevel;
                return (
                  <View
                    key={rank.id}
                    testID={`rank-row-${rank.id}`}
                    accessibilityState={{selected: isCurrent, disabled: !isUnlocked}}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACING.md,
                      padding: SPACING.md,
                      marginBottom: SPACING.sm,
                      borderRadius: CARD_BORDER_RADIUS,
                      borderWidth: isCurrent ? 2 : 1,
                      borderColor: isCurrent ? COLORS.figmaPurple : "rgba(64,31,64,0.14)",
                      backgroundColor: isCurrent ? "#FFF1C7" : "rgba(255,255,255,0.72)",
                      opacity: isUnlocked ? 1 : 0.52,
                    }}
                  >
                    <View
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 27,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isUnlocked ? rank.color : "#8B8790",
                        borderWidth: 2,
                        borderColor: isUnlocked ? "#FFF1B8" : "#D6D2D8",
                      }}
                    >
                      <MaterialCommunityIcons
                        name={isUnlocked ? rank.icon : "lock"}
                        size={26}
                        color={isUnlocked ? "#FFF8DA" : "#F2EEF3"}
                      />
                    </View>
                    <View style={{flex: 1}}>
                      <View style={{flexDirection: "row", justifyContent: "space-between", gap: SPACING.sm}}>
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: TYPOGRAPHY.fontSecondaryBold,
                            fontSize: TYPOGRAPHY.fontSize.base,
                            color: COLORS.black,
                          }}
                        >
                          {t(rank.nameKey)}
                        </Text>
                        <Text
                          style={{
                            fontFamily: TYPOGRAPHY.fontSecondaryBold,
                            fontSize: TYPOGRAPHY.fontSize.xs,
                            color: COLORS.figmaPurple,
                          }}
                        >
                          {t("Ranks.LEVEL_REQUIREMENT_PREFIX")}
                          {rank.minimumLevel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: TYPOGRAPHY.fontSecondary,
                          fontSize: TYPOGRAPHY.fontSize.xs,
                          color: "rgba(0,0,0,0.68)",
                          marginTop: 3,
                        }}
                      >
                        {t(rank.descriptionKey)}
                      </Text>
                      {isCurrent ? (
                        <Text
                          style={{
                            fontFamily: TYPOGRAPHY.fontSecondaryBold,
                            fontSize: TYPOGRAPHY.fontSize.xs,
                            color: COLORS.figmaPurple,
                            marginTop: 5,
                          }}
                        >
                          {t("Ranks.CURRENT_RANK")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default RanksModal;
