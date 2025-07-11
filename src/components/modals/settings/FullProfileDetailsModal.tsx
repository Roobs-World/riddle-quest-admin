import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { Player } from "../../../validation/firestoreSchemas";
import WideButton from "../../buttons/WideButton";
import CloseButton from "../../buttons/CloseButton";
import ChangePasswordModal from "./ChangePasswordModal";
import UpdateUsernameModal from "./UpdateUsernameModal";
import AvatarOptionsModal from "./AvatarOptionsModal";
import PreloadedAvatarsModal from "./PreloadedAvatarsModal";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";

interface FullProfileDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = ({
  isVisible,
  onClose,
  playerData,
}) => {
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isPreloadedAvatarsModalVisible, setIsPreloadedAvatarsModalVisible] =
    useState(false);
  const [isAvatarOptionsModalVisible, setIsAvatarOptionsModalVisible] =
    useState(false);

  if (!playerData) {
    return null;
  }

  const { stats } = playerData;

  const handleUpdateAvatarPress = () => {
    setIsAvatarOptionsModalVisible(true);
  };

  const handleCloseAvatarOptionsModal = () => {
    setIsAvatarOptionsModalVisible(false);
  };

  const handleOpenPreloadedAvatars = () => {
    setIsPreloadedAvatarsModalVisible(true);
  };

  const handleClosePreloadedAvatars = () => {
    setIsPreloadedAvatarsModalVisible(false);
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
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
          <CloseButton
            onPress={onClose}
            size={20}
            style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
          />
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{
              padding: 20,
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={handleUpdateAvatarPress}
              activeOpacity={0.8}
            >
              {playerData.avatarUrl ? (
                <Image
                  testID="avatar-image"
                  source={{ uri: playerData.avatarUrl }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 3,
                    borderColor: "#FCC070",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: "#4A90E2",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 3,
                    borderColor: "#FCC070",
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 32,
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    }}
                  >
                    {playerData.username
                      ? playerData.username.charAt(0).toUpperCase()
                      : ""}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 24,
                fontFamily: TYPOGRAPHY.fontSecondaryBold,
                color: "white",
                marginTop: 12,
              }}
            >
              {playerData.username || "Guest"}
            </Text>

            <View style={{ marginVertical: 20, width: "100%" }}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-around",
                }}
              >
                <StatItem
                  label="Daily Puzzles"
                  value={stats?.dailyPuzzlesCompleted || 0}
                />
                <StatItem
                  label="Games Played"
                  value={stats?.gamesPlayed || 0}
                />
                <StatItem label="Best Streak" value={stats?.bestStreak || 0} />
                <StatItem
                  label="Win Rate"
                  value={Math.round(stats?.winRate || 0)}
                  unit="%"
                />
              </View>
            </View>

            <WideButton
              onPress={() => setIsPasswordModalVisible(true)}
              buttonText="Change Password"
            />
            <View style={{ height: 10 }} />
            <WideButton
              onPress={() => setIsUsernameModalVisible(true)}
              buttonText="Update Username"
            />
          </ScrollView>
        </View>
      </View>

      <ChangePasswordModal
        isVisible={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
      />
      <UpdateUsernameModal
        isVisible={isUsernameModalVisible}
        onClose={() => setIsUsernameModalVisible(false)}
        currentUsername={playerData.username || ""}
      />
      <AvatarOptionsModal
        isVisible={isAvatarOptionsModalVisible}
        onClose={handleCloseAvatarOptionsModal}
        onOpenPreloadedAvatars={handleOpenPreloadedAvatars}
        userId={playerData.userId}
      />
      <PreloadedAvatarsModal
        isVisible={isPreloadedAvatarsModalVisible}
        onClose={handleClosePreloadedAvatars}
        onCloseAvatarOptions={handleCloseAvatarOptionsModal}
      />
    </Modal>
  );
};

const StatItem = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) => (
  <View style={{ width: "50%", alignItems: "center", marginBottom: 16 }}>
    <Text
      style={{
        fontSize: 24,
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        color: "white",
      }}
    >
      {value.toString()}
      {unit}
    </Text>
    <Text
      style={{
        fontSize: 14,
        fontFamily: TYPOGRAPHY.fontSecondary,
        color: "white",
        textAlign: "center",
      }}
    >
      {label}
    </Text>
  </View>
);

export default FullProfileDetailsModal;
