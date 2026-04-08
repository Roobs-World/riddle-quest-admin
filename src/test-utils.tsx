/**
 * Shared test utilities for React Native component tests.
 * Use renderWithModalProvider when testing components that use useModal/useModalContext.
 */

import React from "react";
import { render, RenderOptions } from "@testing-library/react-native";
import { ModalProvider } from "./contexts/ModalContext";

/**
 * Wraps children with ModalProvider for components that use useModal or useModalContext.
 */
export const ModalProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <ModalProvider>{children}</ModalProvider>;

/**
 * Renders a component wrapped with ModalProvider.
 * Use when testing components that call useModal() or useModalContext().
 */
export function renderWithModalProvider(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, {
    ...options,
    wrapper: ModalProviderWrapper,
  });
}
