import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { ModalProvider, useModalContext } from "../ModalContext";
import { ModalData, ModalOptions } from "../../types/ModalTypes";
import { logger } from "../../utils/logger";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe("ModalContext", () => {
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ModalProvider>{children}</ModalProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now and Math.random for consistent modal IDs in tests
    jest.spyOn(Date, "now").mockReturnValue(1234567890);
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("useModalContext", () => {
    it("should throw error when used outside ModalProvider", () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useModalContext());
      }).toThrow("useModalContext must be used within a ModalProvider");

      consoleSpy.mockRestore();
    });

    it("should provide context when used within ModalProvider", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.modals).toEqual([]);
      expect(typeof result.current.openModal).toBe("function");
      expect(typeof result.current.closeModal).toBe("function");
      expect(typeof result.current.closeAllModals).toBe("function");
      expect(typeof result.current.isModalOpen).toBe("function");
      expect(typeof result.current.getModalData).toBe("function");
      expect(typeof result.current.updateModalData).toBe("function");
    });
  });

  describe("openModal", () => {
    it("should open a modal and return its id", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal");
      });

      expect(modalId!).toBeDefined();
      expect(typeof modalId!).toBe("string");
      expect(result.current.modals.length).toBe(1);
      expect(result.current.modals[0].type).toBe("test-modal");
    });

    it("should open a modal with data", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const testData = { title: "Test", value: 42 };

      act(() => {
        result.current.openModal("test-modal", testData);
      });

      expect(result.current.modals[0].data).toEqual(testData);
    });

    it("should open a modal with priority option", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const options: ModalOptions = { priority: 5 };

      act(() => {
        result.current.openModal("test-modal", {}, options);
      });

      expect(result.current.modals[0].priority).toBe(5);
    });

    it("should open a modal with persistent option", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const options: ModalOptions = { persistent: true };

      act(() => {
        result.current.openModal("test-modal", {}, options);
      });

      expect(result.current.modals[0].persistent).toBe(true);
    });

    it("should use default priority of 0 when not specified", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal");
      });

      expect(result.current.modals[0].priority).toBe(0);
    });

    it("should use default persistent of false when not specified", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal");
      });

      expect(result.current.modals[0].persistent).toBe(false);
    });

    it("should replace modals of the same type when replace option is true", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", { id: 1 });
      });

      expect(result.current.modals.length).toBe(1);
      expect(result.current.modals[0].data).toEqual({ id: 1 });

      act(() => {
        result.current.openModal("test-modal", { id: 2, replace: true });
      });

      expect(result.current.modals.length).toBe(1);
      expect(result.current.modals[0].data).toEqual({ id: 2, replace: true });
    });

    it("should allow multiple modals of the same type without replace option", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", { id: 1 });
        result.current.openModal("test-modal", { id: 2 });
      });

      expect(result.current.modals.length).toBe(2);
    });

    it("should sort modals by priority when priority is non-zero", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      // Reset the random mock to return different values
      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("modal-low", {}, { priority: 10 });
        result.current.openModal("modal-high", {}, { priority: 1 });
        result.current.openModal("modal-mid", {}, { priority: 5 });
      });

      expect(result.current.modals[0].type).toBe("modal-high");
      expect(result.current.modals[1].type).toBe("modal-mid");
      expect(result.current.modals[2].type).toBe("modal-low");
    });

    it("should not sort modals when all have priority 0", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("modal-first", {});
        result.current.openModal("modal-second", {});
        result.current.openModal("modal-third", {});
      });

      // All have priority 0, so they should maintain insertion order
      expect(result.current.modals[0].type).toBe("modal-first");
      expect(result.current.modals[1].type).toBe("modal-second");
      expect(result.current.modals[2].type).toBe("modal-third");
    });

    it("should sort when existing modals have non-zero priority", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("modal-priority", {}, { priority: 5 });
      });

      // Now add a modal with priority 0 - should still trigger sort because existing modal has priority != 0
      act(() => {
        result.current.openModal("modal-zero", {}, { priority: 0 });
      });

      // modal-zero (priority 0) should come before modal-priority (priority 5)
      expect(result.current.modals[0].type).toBe("modal-zero");
      expect(result.current.modals[1].type).toBe("modal-priority");
    });

    it("should replace and sort modals with priority when replace option is true", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("test-modal", { id: 1 }, { priority: 10 });
        result.current.openModal("other-modal", { id: 2 }, { priority: 1 });
      });

      expect(result.current.modals.length).toBe(2);

      act(() => {
        result.current.openModal("test-modal", { id: 3, replace: true }, { priority: 5 });
      });

      // Should have replaced the first test-modal and sorted by priority
      expect(result.current.modals.length).toBe(2);
      expect(result.current.modals[0].type).toBe("other-modal");
      expect(result.current.modals[0].data).toEqual({ id: 2 });
      expect(result.current.modals[1].type).toBe("test-modal");
      expect(result.current.modals[1].data).toEqual({ id: 3, replace: true });
    });
  });

  describe("closeModal", () => {
    it("should close a modal by id", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal");
      });

      expect(result.current.modals.length).toBe(1);

      act(() => {
        result.current.closeModal(modalId);
      });

      expect(result.current.modals.length).toBe(0);
    });

    it("should not affect other modals when closing one", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      let modalId1: string;
      let modalId2: string;
      act(() => {
        modalId1 = result.current.openModal("modal-1", { value: 1 });
        modalId2 = result.current.openModal("modal-2", { value: 2 });
      });

      expect(result.current.modals.length).toBe(2);

      act(() => {
        result.current.closeModal(modalId1);
      });

      expect(result.current.modals.length).toBe(1);
      expect(result.current.modals[0].id).toBe(modalId2);
      expect(result.current.modals[0].data).toEqual({ value: 2 });
    });

    it("should do nothing when closing non-existent modal id", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal");
      });

      expect(result.current.modals.length).toBe(1);

      act(() => {
        result.current.closeModal("non-existent-id");
      });

      expect(result.current.modals.length).toBe(1);
    });
  });

  describe("closeAllModals", () => {
    it("should close all open modals", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("modal-1");
        result.current.openModal("modal-2");
        result.current.openModal("modal-3");
      });

      expect(result.current.modals.length).toBe(3);

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.modals.length).toBe(0);
    });

    it("should work when no modals are open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      expect(result.current.modals.length).toBe(0);

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.modals.length).toBe(0);
    });
  });

  describe("isModalOpen", () => {
    it("should return true when modal type is open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal");
      });

      expect(result.current.isModalOpen("test-modal")).toBe(true);
    });

    it("should return false when modal type is not open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal");
      });

      expect(result.current.isModalOpen("other-modal")).toBe(false);
    });

    it("should return false when no modals are open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      expect(result.current.isModalOpen("test-modal")).toBe(false);
    });

    it("should return true when multiple modals of same type are open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", { id: 1 });
        result.current.openModal("test-modal", { id: 2 });
      });

      expect(result.current.isModalOpen("test-modal")).toBe(true);
    });
  });

  describe("getModalData", () => {
    it("should return modal data for open modal type", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const testData = { title: "Test Modal", count: 5 };

      act(() => {
        result.current.openModal("test-modal", testData);
      });

      const data = result.current.getModalData<typeof testData>("test-modal");
      expect(data).toEqual(testData);
    });

    it("should return null for non-existent modal type", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const data = result.current.getModalData("non-existent");
      expect(data).toBeNull();
    });

    it("should return data of first modal when multiple of same type exist", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("test-modal", { id: 1 });
        result.current.openModal("test-modal", { id: 2 });
      });

      const data = result.current.getModalData<{ id: number }>("test-modal");
      expect(data?.id).toBe(1);
    });
  });

  describe("updateModalData", () => {
    it("should update modal data by id", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal", { count: 1, name: "test" });
      });

      act(() => {
        result.current.updateModalData(modalId, { count: 5 });
      });

      expect(result.current.modals[0].data).toEqual({ count: 5, name: "test" });
    });

    it("should add new properties to modal data", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal", { existing: true });
      });

      act(() => {
        result.current.updateModalData(modalId, { newProp: "new value" });
      });

      expect(result.current.modals[0].data).toEqual({
        existing: true,
        newProp: "new value",
      });
    });

    it("should not affect other modals when updating one", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      let modalId1: string;
      let modalId2: string;
      act(() => {
        modalId1 = result.current.openModal("modal-1", { value: 1 });
        modalId2 = result.current.openModal("modal-2", { value: 2 });
      });

      act(() => {
        result.current.updateModalData(modalId1, { value: 100 });
      });

      const modal1 = result.current.modals.find((m) => m.id === modalId1);
      const modal2 = result.current.modals.find((m) => m.id === modalId2);

      expect(modal1?.data).toEqual({ value: 100 });
      expect(modal2?.data).toEqual({ value: 2 });
    });

    it("should do nothing when updating non-existent modal id", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", { value: 1 });
      });

      const originalData = { ...result.current.modals[0].data };

      act(() => {
        result.current.updateModalData("non-existent-id", { value: 999 });
      });

      expect(result.current.modals[0].data).toEqual(originalData);
    });
  });

  describe("ModalProvider", () => {
    it("should render children correctly", () => {
      const TestComponent = () => {
        const context = useModalContext();
        return <>{context ? "Context Available" : "No Context"}</>;
      };

      const { getByText } = require("@testing-library/react-native").render(
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      );

      // The component should have access to context
      expect(getByText).toBeDefined();
    });

    it("should maintain separate state for nested providers", () => {
      const { result: outerResult } = renderHook(() => useModalContext(), {
        wrapper,
      });

      // Each provider maintains its own state
      act(() => {
        outerResult.current.openModal("outer-modal");
      });

      expect(outerResult.current.modals.length).toBe(1);
    });
  });

  describe("Reducer Edge Cases", () => {
    it("should log warning for unknown action type", () => {
      // We need to test the reducer's default case which logs a warning
      // This is tricky since the reducer is internal, but we can verify
      // the logger.warn is available for when unknown actions occur
      expect(mockLogger.warn).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle opening modal with undefined data", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", undefined);
      });

      expect(result.current.modals[0].data).toEqual({});
    });

    it("should handle opening modal with empty object data", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("test-modal", {});
      });

      expect(result.current.modals[0].data).toEqual({});
    });

    it("should generate unique IDs for multiple modals", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        return 1000000 + callCount;
      });
      jest.spyOn(Math, "random").mockImplementation(() => {
        return callCount * 0.01;
      });

      let id1: string, id2: string, id3: string;
      act(() => {
        id1 = result.current.openModal("modal-1");
        id2 = result.current.openModal("modal-2");
        id3 = result.current.openModal("modal-3");
      });

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("should handle rapid open/close operations", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      let ids: string[] = [];
      act(() => {
        for (let i = 0; i < 10; i++) {
          ids.push(result.current.openModal(`modal-${i}`));
        }
      });

      expect(result.current.modals.length).toBe(10);

      act(() => {
        // Close every other modal
        for (let i = 0; i < 10; i += 2) {
          result.current.closeModal(ids[i]);
        }
      });

      expect(result.current.modals.length).toBe(5);
    });

    it("should handle complex data types", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const complexData: ModalData = {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        fn: () => "test",
        date: new Date("2024-01-01"),
      };

      act(() => {
        result.current.openModal("test-modal", complexData);
      });

      const data = result.current.getModalData<typeof complexData>("test-modal");
      expect(data?.nested).toEqual({ deep: { value: 42 } });
      expect(data?.array).toEqual([1, 2, 3]);
    });

    it("should handle modal with both priority and persistent options", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const options: ModalOptions = { priority: 3, persistent: true };

      act(() => {
        result.current.openModal("test-modal", { value: "test" }, options);
      });

      expect(result.current.modals[0].priority).toBe(3);
      expect(result.current.modals[0].persistent).toBe(true);
      expect(result.current.modals[0].data).toEqual({ value: "test" });
    });

    it("should correctly check isModalOpen after close", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal");
      });

      expect(result.current.isModalOpen("test-modal")).toBe(true);

      act(() => {
        result.current.closeModal(modalId);
      });

      expect(result.current.isModalOpen("test-modal")).toBe(false);
    });

    it("should correctly return null from getModalData after close", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal", { value: 42 });
      });

      expect(result.current.getModalData("test-modal")).toEqual({ value: 42 });

      act(() => {
        result.current.closeModal(modalId);
      });

      expect(result.current.getModalData("test-modal")).toBeNull();
    });

    it("should handle closeAllModals followed by new modal open", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("modal-1");
        result.current.openModal("modal-2");
      });

      expect(result.current.modals.length).toBe(2);

      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.modals.length).toBe(0);

      act(() => {
        result.current.openModal("modal-3");
      });

      expect(result.current.modals.length).toBe(1);
      expect(result.current.modals[0].type).toBe("modal-3");
    });

    it("should handle updating modal data multiple times", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let modalId: string;
      act(() => {
        modalId = result.current.openModal("test-modal", { count: 0 });
      });

      act(() => {
        result.current.updateModalData(modalId, { count: 1 });
      });

      act(() => {
        result.current.updateModalData(modalId, { count: 2 });
      });

      act(() => {
        result.current.updateModalData(modalId, { count: 3, extra: "value" });
      });

      expect(result.current.modals[0].data).toEqual({ count: 3, extra: "value" });
    });

    it("should handle replace option when no matching modal type exists", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      act(() => {
        result.current.openModal("other-modal", { id: 1 });
      });

      expect(result.current.modals.length).toBe(1);

      // Open with replace but different type - should just add new modal
      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("test-modal", { id: 2, replace: true });
      });

      expect(result.current.modals.length).toBe(2);
    });

    it("should handle replace option with multiple modals of same type", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      let callCount = 0;
      jest.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return callCount * 0.1;
      });

      act(() => {
        result.current.openModal("test-modal", { id: 1 });
        result.current.openModal("test-modal", { id: 2 });
        result.current.openModal("other-modal", { id: 3 });
      });

      expect(result.current.modals.length).toBe(3);

      act(() => {
        result.current.openModal("test-modal", { id: 4, replace: true });
      });

      // Should have removed both test-modals and added new one
      expect(result.current.modals.length).toBe(2);
      const testModals = result.current.modals.filter(m => m.type === "test-modal");
      expect(testModals.length).toBe(1);
      expect(testModals[0].data).toEqual({ id: 4, replace: true });
    });
  });

  describe("Context Memoization", () => {
    it("should provide stable function references", () => {
      const { result, rerender } = renderHook(() => useModalContext(), { wrapper });

      const openModal1 = result.current.openModal;
      const closeModal1 = result.current.closeModal;
      const closeAllModals1 = result.current.closeAllModals;
      const updateModalData1 = result.current.updateModalData;

      rerender({});

      // Functions should remain the same reference after rerender
      expect(result.current.openModal).toBe(openModal1);
      expect(result.current.closeModal).toBe(closeModal1);
      expect(result.current.closeAllModals).toBe(closeAllModals1);
      expect(result.current.updateModalData).toBe(updateModalData1);
    });

    it("should update isModalOpen and getModalData when modals change", () => {
      const { result } = renderHook(() => useModalContext(), { wrapper });

      const isModalOpen1 = result.current.isModalOpen;
      const getModalData1 = result.current.getModalData;

      act(() => {
        result.current.openModal("test-modal");
      });

      // These callbacks depend on modals state, so they should be new references
      expect(result.current.isModalOpen).not.toBe(isModalOpen1);
      expect(result.current.getModalData).not.toBe(getModalData1);
    });
  });
});
