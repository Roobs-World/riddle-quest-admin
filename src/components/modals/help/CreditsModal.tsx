import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import CloseButton from "../../buttons/CloseButton";

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
            style={{
              fontSize: 24,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 16,
              color: "black",
            }}
          >
            Credits
          </Text>

          <Text
            style={{
              fontSize: 16,
              textAlign: "center",
              marginBottom: 20,
              color: "#666",
            }}
          >
            Meet the amazing team behind Qwordly
          </Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          >
            {teamMembers.map((member, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "#f9f9f9",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: 4,
                    color: "black",
                  }}
                >
                  {member.name}
                </Text>
                <Text
                  style={{ fontSize: 14, textAlign: "center", color: "#666" }}
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
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: 8,
                  color: "black",
                }}
              >
                Thank You!
              </Text>
              <Text
                style={{ fontSize: 14, textAlign: "center", color: "#666" }}
              >
                Special thanks to all our contributors who made Qwordly
                possible. Your creativity, dedication, and passion brought this
                project to life.
              </Text>
            </View>
          </ScrollView>

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
