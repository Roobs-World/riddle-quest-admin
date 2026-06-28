import React from "react";
import {View, type StyleProp, type ViewStyle} from "react-native";
import ModalBg from "../../../assets/images/modal-bg.svg";
import HomeBg from "../../../assets/images/home-bg.svg";
import SlideInModalContent from "./SlideInModalContent";

interface DecoratedModalShellProps {
  isVisible: boolean;
  width: number;
  height: number;
  children: React.ReactNode;
  slideInStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  modalBgStyle?: StyleProp<ViewStyle>;
  homeBgStyle?: StyleProp<ViewStyle>;
  homeWidthMultiplier?: number;
  homeHeightMultiplier?: number;
  homeTopOffsetMultiplier?: number;
  homeLeftOffsetMultiplier?: number;
  preserveAspectRatio?: "none" | "xMidYMid meet" | "xMidYMid slice";
  modalBgTestID?: string;
}

const DecoratedModalShell: React.FC<DecoratedModalShellProps> = ({
  isVisible,
  width,
  height,
  children,
  slideInStyle,
  frameStyle,
  contentStyle,
  modalBgStyle,
  homeBgStyle,
  homeWidthMultiplier = 1.1,
  homeHeightMultiplier = 1.05,
  homeTopOffsetMultiplier = 0.05,
  homeLeftOffsetMultiplier = 0.05,
  preserveAspectRatio = "none",
  modalBgTestID,
}) => {
  return (
    <SlideInModalContent isVisible={isVisible} style={slideInStyle}>
      <View
        style={[
          {
            width,
            height,
            alignItems: "center",
            justifyContent: "center",
            overflow: "visible",
          },
          frameStyle,
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width,
            height,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <ModalBg
            testID={modalBgTestID}
            width={width}
            height={height}
            preserveAspectRatio={preserveAspectRatio}
            style={[{position: "absolute"}, modalBgStyle]}
          />
          <HomeBg
            width={width * homeWidthMultiplier}
            height={height * homeHeightMultiplier}
            style={[
              {
                position: "absolute",
                top: -height * homeTopOffsetMultiplier,
                left: -width * homeLeftOffsetMultiplier,
              },
              homeBgStyle,
            ]}
          />
        </View>
        <View
          style={[
            {
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </SlideInModalContent>
  );
};

export default DecoratedModalShell;
