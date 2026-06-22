import React from "react";
import {StyleSheet, View, type StyleProp, type ViewStyle} from "react-native";
import CustomSafeAreaView from "./CustomSafeAreaView";
import StarryBackground from "../background/StarryBackground";
import {styles} from "../../styles";

interface AuthScreenShellProps {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const AuthScreenShell: React.FC<AuthScreenShellProps> = ({children, contentContainerStyle}) => {
  return (
    <CustomSafeAreaView className="justify-start">
      <StarryBackground />

      <View style={screenStyles.root}>
        <View style={[styles.authContentContainer, screenStyles.content, contentContainerStyle]}>{children}</View>
      </View>
    </CustomSafeAreaView>
  );
};

const screenStyles = StyleSheet.create({
  content: {
    flex: 1,
  },
  root: {
    alignItems: "center",
    flex: 1,
    width: "100%",
    zIndex: 2,
  },
});

export default AuthScreenShell;
