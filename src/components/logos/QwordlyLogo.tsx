import React from "react";
import { StyleSheet } from "react-native";
import Logo from "@images/main-logo.svg";

const QwordlyLogo = () => {
  return <Logo style={styles.logo} />;
};

const styles = StyleSheet.create({
  logo: {
    height: 70,
    width: 288,
  },
});

export default QwordlyLogo;
