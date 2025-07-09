import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import HomeBgSvg from "../../../../assets/images/home-bg.svg";
import { styles } from "../../../styles";

interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  const teamMembers = [
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
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            backgroundColor: "#FCFAF4",
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            height: "100%",
            paddingTop: 40,
            flex: 1,
          }}
        >
          <HomeBgSvg
            width="120%"
            height="100%"
            style={styles.backgroundImage}
          />

          {/* Drag Handle */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              backgroundColor: "#D1D5DB",
              borderRadius: 2,
              marginBottom: 20,
            }}
          />

          <View
            style={{ position: "absolute", top: 50, right: 20, zIndex: 10 }}
          >
            <CloseButton onPress={onClose} size={20} />
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text
              className="text-2xl font-bold text-gray-800 text-center mb-4"
              style={styles.creditsTitle}
            >
              Credits
            </Text>

            <Text
              className="text-lg text-gray-600 text-center mb-8"
              style={styles.creditsSubtitle}
            >
              Meet the amazing team behind Qwordly
            </Text>
          </View>

          <View style={{ flex: 1, paddingBottom: 80 }}>
            <ScrollView
              className="flex-1 w-full"
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {teamMembers.map((member, index) => (
                <View
                  key={index}
                  className="bg-white/90 rounded-lg p-6 mb-4 mx-4 shadow-sm"
                  style={styles.teamMemberCard}
                >
                  <Text
                    className="text-xl font-bold text-gray-800 text-center mb-2"
                    style={styles.memberName}
                  >
                    {member.name}
                  </Text>
                  <Text
                    className="text-base text-gray-600 text-center"
                    style={styles.memberRole}
                  >
                    {member.role}
                  </Text>
                </View>
              ))}

              <View className="mt-8 mx-4">
                <Text
                  className="text-lg font-bold text-gray-800 text-center mb-4"
                  style={styles.thankYouTitle}
                >
                  Thank You!
                </Text>
                <Text
                  className="text-base text-gray-600 text-center"
                  style={styles.thankYouText}
                >
                  Special thanks to all our contributors who made Qwordly
                  possible. Your creativity, dedication, and passion brought
                  this project to life.
                </Text>
              </View>
            </ScrollView>
          </View>

          <View
            style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}
          >
            <TouchableOpacity
              className="bg-blue-500 py-3 px-6 rounded-lg self-center"
              onPress={onClose}
            >
              <Text
                className="text-white text-lg font-semibold"
                style={styles.creditsTitle}
              >
                Got It!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CreditsModal;
