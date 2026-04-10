import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from "react";
import {
  ModalContextState,
  ModalInstance,
  ModalData,
  ModalOptions,
  ModalAction,
} from "../types/ModalTypes";
import { logger } from "src/utils/logger";

// Initial state
const initialState: ModalInstance[] = [];

// Modal reducer
const modalReducer = (
  state: ModalInstance[],
  action: ModalAction
): ModalInstance[] => {
  switch (action.type) {
    case "OPEN_MODAL": {
      // If replace option is true, close all modals of the same type
      const needsSort = action.payload.priority !== 0 || state.some((m) => m.priority !== 0);
      if (
        action.payload.data &&
        "replace" in action.payload.data &&
        action.payload.data.replace
      ) {
        const filteredState = state.filter(
          (modal) => modal.type !== action.payload.type
        );
        const next = [...filteredState, action.payload];
        return needsSort ? next.sort((a, b) => a.priority - b.priority) : next;
      }
      const next = [...state, action.payload];
      return needsSort ? next.sort((a, b) => a.priority - b.priority) : next;
    }

    case "CLOSE_MODAL":
      return state.filter((modal) => modal.id !== action.payload);

    case "CLOSE_ALL_MODALS":
      return [];

    case "UPDATE_MODAL_DATA":
      return state.map((modal) =>
        modal.id === action.payload.id
          ? { ...modal, data: { ...modal.data, ...action.payload.data } }
          : modal
      );

    default:
      logger.warn("modal reducer unsure of action: " + action)
      return state;
  }
};

// Context
const ModalContext = createContext<ModalContextState | undefined>(undefined);

// Generate unique ID for modals
const generateModalId = (): string => {
  return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Modal Provider component
export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [modals, dispatch] = useReducer(modalReducer, initialState);

  // Open modal function
  const openModal = useCallback(
    <T extends ModalData>(
      type: string,
      data?: T,
      options?: ModalOptions
    ): string => {
      const id = generateModalId();
      const priority = options?.priority ?? 0;
      const persistent = options?.persistent ?? false;

      const modalInstance: ModalInstance<T> = {
        id,
        type,
        data: data || ({} as T),
        priority,
        persistent,
      };

      dispatch({ type: "OPEN_MODAL", payload: modalInstance });
      return id;
    },
    []
  );

  // Close modal function
  const closeModal = useCallback((id: string): void => {
    dispatch({ type: "CLOSE_MODAL", payload: id });
  }, []);

  // Close all modals function
  const closeAllModals = useCallback((): void => {
    dispatch({ type: "CLOSE_ALL_MODALS" });
  }, []);

  // Check if modal is open
  const isModalOpen = useCallback(
    (type: string): boolean => {
      return modals.some((modal) => modal.type === type);
    },
    [modals]
  );

  // Get modal data
  const getModalData = useCallback(
    <T extends ModalData>(type: string): T | null => {
      const modal = modals.find((modal) => modal.type === type);
      return modal ? (modal.data as T) : null;
    },
    [modals]
  );

  // Update modal data
  const updateModalData = useCallback(
    <T extends ModalData>(id: string, data: Partial<T>): void => {
      dispatch({ type: "UPDATE_MODAL_DATA", payload: { id, data } });
    },
    []
  );

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    (): ModalContextState => ({
      modals,
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
      getModalData,
      updateModalData,
    }),
    [
      modals,
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
      getModalData,
      updateModalData,
    ]
  );

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
    </ModalContext.Provider>
  );
};

// Custom hook to use modal context
export const useModalContext = (): ModalContextState => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModalContext must be used within a ModalProvider");
  }
  return context;
};

