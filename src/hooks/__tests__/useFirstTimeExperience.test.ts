/**
 * @fileoverview Unit tests for useFirstTimeExperience hook.
 *
 * Tests that the hook shows the welcome modal on mount.
 */

import { renderHook } from "@testing-library/react-native";
import React from "react";
import { useFirstTimeExperience } from "../useFirstTimeExperience";
import { ModalProvider } from "../../contexts/ModalContext";

// Create a wrapper component that provides the modal context
const createWrapper = () => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement(ModalProvider, null, children);
  };
  return Wrapper;
};

// Mock the useModal hook to spy on showWelcomeModal
const mockShowWelcomeModal = jest.fn(() => "mock-modal-id");

jest.mock("../useModal", () => ({
  useModal: () => ({
    showWelcomeModal: mockShowWelcomeModal,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    closeAllModals: jest.fn(),
    isModalOpen: jest.fn(),
    getModalData: jest.fn(),
    updateModalData: jest.fn(),
    modals: [],
  }),
}));

describe("useFirstTimeExperience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call showWelcomeModal on mount", () => {
    renderHook(() => useFirstTimeExperience(), {
      wrapper: createWrapper(),
    });

    expect(mockShowWelcomeModal).toHaveBeenCalledTimes(1);
  });

  it("should only call showWelcomeModal once even on re-render", () => {
    const { rerender } = renderHook(() => useFirstTimeExperience(), {
      wrapper: createWrapper(),
    });

    // Re-render the hook
    rerender({});
    rerender({});

    // Should still only be called once (on initial mount)
    expect(mockShowWelcomeModal).toHaveBeenCalledTimes(1);
  });

  it("should call showWelcomeModal with no arguments", () => {
    renderHook(() => useFirstTimeExperience(), {
      wrapper: createWrapper(),
    });

    expect(mockShowWelcomeModal).toHaveBeenCalledWith();
  });

  it("should not throw errors", () => {
    expect(() => {
      renderHook(() => useFirstTimeExperience(), {
        wrapper: createWrapper(),
      });
    }).not.toThrow();
  });
});
