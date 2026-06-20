import React, {useCallback, useState} from "react";
import {Modal, Pressable, ScrollView, Text, View} from "react-native";
import WideButton from "../../buttons/WideButton";
import {
  CARD_BORDER_RADIUS,
  COLOR_CLUE_BORDER_RADIUS,
  COLOR_CLUE_INDICATOR_SIZE,
  COLOR_CLUE_MARGIN_RIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_HEIGHT,
  MODAL_MAX_HEIGHT,
  MODAL_WIDTH,
} from "../../../constants/layout";
import {COLORS, SPACING, TYPOGRAPHY} from "../../../styles";
import {verticalScale} from "../../../utils/responsive";
import {t} from "../../../i18n";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import {OnboardingLogoHeader} from "../../branding/RiddleQuestLogo";
import OnboardingProgressBadge from "../OnboardingProgressBadge";

interface GuestOnboardingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

type GuestOnboardingStep = "welcome" | "instructions" | "guestNotice";

const ONBOARDING_PROGRESS_TOTAL = 3;
const WELCOME_COPY_TOP_OFFSET = verticalScale(132);
const INSTRUCTIONS_MODAL_HEIGHT = Math.min(MODAL_MAX_HEIGHT ?? 600, 560);

const GuestOnboardingModal: React.FC<GuestOnboardingModalProps> = ({isVisible, onClose, onUpgrade}) => {
  const [step, setStep] = useState<GuestOnboardingStep>("welcome");
  const welcomeHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const noticeHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);

  const handleComplete = useCallback(() => {
    onClose();
    setStep("welcome");
  }, [onClose]);

  const handleUpgrade = useCallback(() => {
    onUpgrade();
    setStep("welcome");
  }, [onUpgrade]);

  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={handleComplete}>
      <View style={{flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)"}}>
        <RotatingWheelBackground isVisible={isVisible} />

        {step === "welcome" ? (
          <DecoratedModalShell
            isVisible={isVisible}
            width={MODAL_WIDTH}
            height={welcomeHeight}
            frameStyle={{
              overflow: "hidden",
              marginBottom: welcomeHeight * 0.28,
              paddingTop: verticalScale(30),
            }}
          >
            <Pressable
              onPress={() => setStep("instructions")}
              accessibilityRole="button"
              testID="guest-onboarding-welcome-touch-target"
              style={{width: "100%", height: "100%"}}
            >
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: MODAL_CONTENT_PADDING,
                  paddingTop: MODAL_CONTENT_PADDING,
                }}
              >
                <OnboardingLogoHeader />
                <View
                  testID="guest-onboarding-welcome-copy-block"
                  style={{width: "80%", position: "absolute", marginTop: WELCOME_COPY_TOP_OFFSET}}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: COLORS.black,
                      textAlign: "center",
                      position: "absolute",
                      marginTop: verticalScale(80),
                    }}
                  >
                    {t("WelcomeModal.SOLVE_RIDDLES_TEXT")}
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: COLORS.black,
                      textAlign: "center",
                    }}
                  >
                    {t("WelcomeModal.EARN_COINS_TEXT")}
                  </Text>
                </View>
                <OnboardingProgressBadge current={1} total={ONBOARDING_PROGRESS_TOTAL} />
              </View>
            </Pressable>
          </DecoratedModalShell>
        ) : null}

        {step === "instructions" ? (
          <DecoratedModalShell
            isVisible={isVisible}
            width={MODAL_WIDTH}
            height={INSTRUCTIONS_MODAL_HEIGHT}
            frameStyle={{overflow: "hidden", paddingTop: verticalScale(30)}}
            contentStyle={{justifyContent: "flex-start"}}
            modalBgTestID="guest-onboarding-instructions-background"
          >
            <Pressable
              accessibilityLabel={t("WelcomeBackModal.TAP_TO_CONTINUE")}
              accessibilityRole="button"
              onPress={() => setStep("guestNotice")}
              style={{width: "100%", height: "100%"}}
              testID="guest-onboarding-instructions-touch-target"
            >
              <InstructionsContent />
            </Pressable>
          </DecoratedModalShell>
        ) : null}

        {step === "guestNotice" ? (
          <DecoratedModalShell
            isVisible={isVisible}
            width={MODAL_WIDTH}
            height={noticeHeight}
            frameStyle={{overflow: "hidden", paddingTop: verticalScale(30)}}
            contentStyle={{justifyContent: "flex-start"}}
            modalBgTestID="guest-onboarding-notice-background"
          >
            <View style={{flex: 1, width: "100%", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.lg}}>
              <OnboardingLogoHeader />
              <OnboardingProgressBadge current={3} total={ONBOARDING_PROGRESS_TOTAL} />
              <ScrollView
                style={{maxHeight: noticeHeight * 0.34, width: "100%"}}
                contentContainerStyle={{alignItems: "center", paddingBottom: SPACING.sm}}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    color: COLORS.black,
                    marginBottom: SPACING.lg,
                    textAlign: "center",
                  }}
                >
                  {t("GameScreenAlerts.GUEST_MODE_NOTICE_MESSAGE")}
                </Text>
              </ScrollView>
              <View style={{width: "100%", marginTop: "auto"}}>
                <View style={{marginBottom: SPACING.md}}>
                  <WideButton
                    buttonText={t("Profile.UPGRADE_ACCOUNT_BUTTON")}
                    onPress={handleUpgrade}
                    disabled={false}
                  />
                </View>
                <WideButton buttonText={t("CommonAlerts.OK_BUTTON")} onPress={handleComplete} disabled={false} />
              </View>
            </View>
          </DecoratedModalShell>
        ) : null}
      </View>
    </Modal>
  );
};

const InstructionsContent = () => (
  <View
    style={{
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: MODAL_CONTENT_PADDING,
      paddingBottom: MODAL_CONTENT_PADDING,
    }}
  >
    <OnboardingLogoHeader />
    <OnboardingProgressBadge current={2} total={ONBOARDING_PROGRESS_TOTAL} />
    <View style={{width: "100%", gap: SPACING.xs, paddingTop: SPACING.xs}}>
      <InstructionCard
        title={t("Instructions.GOAL_TITLE")}
        description={t("Instructions.GOAL_DESCRIPTION")}
      />
      <InstructionCard title={t("Instructions.COLOR_CLUES_TITLE")}>
        <View style={{gap: SPACING.sm, alignItems: "flex-start"}}>
          <ColorClue color="#22c55e" text={t("Instructions.COLOR_CORRECT")} />
          <ColorClue color="#eab308" text={t("Instructions.COLOR_MISPLACED")} />
          <ColorClue color="#ef4444" text={t("Instructions.COLOR_WRONG")} />
        </View>
      </InstructionCard>
      <InstructionCard
        title={t("Instructions.TIPS_TITLE")}
        description={t("Instructions.TIPS_DESCRIPTION")}
      />
    </View>
  </View>
);

const InstructionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) => (
  <View style={{borderRadius: CARD_BORDER_RADIUS, padding: SPACING.sm, marginBottom: 0, width: "100%"}}>
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: TYPOGRAPHY.fontSize.xl,
        color: COLORS.black,
        textAlign: "center",
      }}
    >
      {title}
    </Text>
    {description ? (
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          color: COLORS.black,
          textAlign: "center",
          lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.snug,
        }}
      >
        {description}
      </Text>
    ) : null}
    {children}
  </View>
);

const ColorClue = ({color, text}: {color: string; text: string}) => (
  <View style={{flexDirection: "row", alignItems: "center"}}>
    <View
      style={{
        width: COLOR_CLUE_INDICATOR_SIZE,
        height: COLOR_CLUE_INDICATOR_SIZE,
        backgroundColor: color,
        borderRadius: COLOR_CLUE_BORDER_RADIUS,
        marginRight: COLOR_CLUE_MARGIN_RIGHT,
      }}
    />
    <Text
      style={{
        flex: 1,
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.sm,
        color: COLORS.black,
        lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.snug,
      }}
    >
      {text}
    </Text>
  </View>
);

export default GuestOnboardingModal;
