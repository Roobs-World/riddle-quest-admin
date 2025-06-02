import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  backgroundImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: "-5%",
    zIndex: -1,
  },
  creditsLink: {
    fontFamily: "Poppins",
  },
  gameContainer: {
    flex: 1,
  },
  gameContainerTablet: {
    paddingHorizontal: 20,
  },
  overlayVisible: {
    opacity: 0.3,
  },
  separatorText: {
    fontFamily: "Poppins",
  },
  title: {
    fontFamily: "PoetsenOne",
    fontSize: 26,
    fontWeight: "400",
    letterSpacing: -0.104,
    lineHeight: 34.32,
  },
});
