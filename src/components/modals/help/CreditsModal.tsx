import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { styles } from "../../../styles";

interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  const teamMembers = [
    { name: "Craig Beswetherick", role: "Lead Developer & Game Design" },
    { name: "Reuben Beswetherick", role: "Inspiration" },
    { name: "Thomas Lemrond", role: "Game Designer, Publisher, Overall Hero" },
    { name: "Gavin Harrison", role: "Sound Design" },
    { name: "Nathalia", role: "Design" },
    { name: "Mr Ben", role: "Design" },
  ];

  return (
    <Modal
      animationType="slide"
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
        <View
          style={{
            backgroundColor: "white",
            margin: 20,
            padding: 20,
            borderRadius: 10,
            width: "90%",
            height: "80%",
          }}
        >
          <View style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text
            style={[
              styles.creditsTitle,
              { textAlign: "center", marginBottom: 16, color: "black" },
            ]}
          >
            Credits
          </Text>

          <Text
            style={[
              styles.creditsSubtitle,
              { textAlign: "center", marginBottom: 20, color: "#666" },
            ]}
          >
            Meet the amazing team behind Qwordly
          </Text>

          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {teamMembers.map((member, index) => (
                <View
                  key={index}
                  style={[
                    styles.teamMemberCard,
                    {
                      backgroundColor: "#f9f9f9",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      marginHorizontal: 4,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberName,
                      { textAlign: "center", marginBottom: 8, color: "black" },
                    ]}
                  >
                    {member.name}
                  </Text>
                  <Text
                    style={[
                      styles.memberRole,
                      { textAlign: "center", color: "#666" },
                    ]}
                  >
                    {member.role}
                  </Text>
                </View>
              ))}

              <View
                style={{
                  marginTop: 20,
                  padding: 16,
                  backgroundColor: "#f0f8ff",
                  borderRadius: 8,
                  marginHorizontal: 4,
                }}
              >
                <Text
                  style={[
                    styles.thankYouTitle,
                    { textAlign: "center", marginBottom: 8, color: "black" },
                  ]}
                >
                  Thank You!
                </Text>
                <Text
                  style={[
                    styles.thankYouText,
                    { textAlign: "center", color: "#666" },
                  ]}
                >
                  Special thanks to all our contributors who made Qwordly
                  possible. Your creativity, dedication, and passion brought
                  this project to life.
                </Text>
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: "#3b82f6",
              padding: 12,
              borderRadius: 8,
              marginTop: 10,
              alignSelf: "center",
            }}
            onPress={onClose}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
              Got It!
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default CreditsModal;
