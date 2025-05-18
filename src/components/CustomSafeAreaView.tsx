import React from "react";
import { SafeAreaView, ViewProps } from "react-native";

/**
 * Props for the CustomSafeAreaView component.
 * Extends standard ViewProps to include children and an optional className.
 * @property {React.ReactNode} children - The content to be rendered within the safe area view.
 * @property {string} [className] - Optional NativeWind class names to apply to the safe area view.
 */
interface CustomSafeAreaViewProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A custom SafeAreaView component with default styling.
 * It provides a safe area for content and applies background color, flex properties, padding, and margin.
 * @param {CustomSafeAreaViewProps} props - The props for the component.
 * @returns {React.FC<CustomSafeAreaViewProps>} The rendered SafeAreaView component.
 */
const CustomSafeAreaView: React.FC<CustomSafeAreaViewProps> = ({
  children,
  style,
  className,
  ...rest
}) => {
  const combinedClassName = `bg-[#FCFAF4] flex-1 justify-center items-center p-6 my-12 ${
    className || ""
  }`;

  return (
    <SafeAreaView className={combinedClassName} style={[style]} {...rest}>
      {children}
    </SafeAreaView>
  );
};

export default CustomSafeAreaView;
