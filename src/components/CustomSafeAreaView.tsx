import React from "react";
import { SafeAreaView, ViewProps } from "react-native";

interface CustomSafeAreaViewProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

const CustomSafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  style,
  className,
  ...rest
}) => {
  const combinedClassName = `bg-[#FCFAF4] flex-1 justify-center items-center p-6 ${
    className || ""
  }`;

  return (
    <SafeAreaView className={combinedClassName} style={[style]} {...rest}>
      {children}
    </SafeAreaView>
  );
};

export default CustomSafeAreaView;
