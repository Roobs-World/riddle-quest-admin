import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import {Modal} from "react-native";
import DeleteAccountConfirmationModal from "../DeleteAccountConfirmationModal";
import {t} from "../../../../i18n";

describe("DeleteAccountConfirmationModal", () => {
  const mockOnCancel = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the destructive warning and actions", () => {
    const {getByText, getByTestId} = render(
      <DeleteAccountConfirmationModal isVisible isDeleting={false} onCancel={mockOnCancel} onConfirm={mockOnConfirm} />,
    );

    expect(getByText(t("Profile.DELETE_ACCOUNT_CONFIRM_TITLE"))).toBeTruthy();
    expect(getByText(t("Profile.DELETE_ACCOUNT_CONFIRM_MESSAGE"))).toBeTruthy();
    expect(getByTestId("delete-account-confirm-button")).toBeTruthy();
    expect(getByTestId("delete-account-cancel-button")).toBeTruthy();
  });

  it("fires confirm and cancel actions when not deleting", () => {
    const {getByTestId} = render(
      <DeleteAccountConfirmationModal isVisible isDeleting={false} onCancel={mockOnCancel} onConfirm={mockOnConfirm} />,
    );

    fireEvent.press(getByTestId("delete-account-confirm-button"));
    fireEvent.press(getByTestId("delete-account-cancel-button"));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("uses cancel for Android back only while not deleting", () => {
    const {UNSAFE_getByType, rerender} = render(
      <DeleteAccountConfirmationModal isVisible isDeleting={false} onCancel={mockOnCancel} onConfirm={mockOnConfirm} />,
    );

    expect(UNSAFE_getByType(Modal).props.onRequestClose).toBe(mockOnCancel);

    rerender(<DeleteAccountConfirmationModal isVisible isDeleting onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);

    expect(UNSAFE_getByType(Modal).props.onRequestClose).toBeUndefined();
  });

  it("shows a loading state while deletion is in progress", () => {
    const {getByText} = render(
      <DeleteAccountConfirmationModal isVisible isDeleting onCancel={mockOnCancel} onConfirm={mockOnConfirm} />,
    );

    expect(getByText(t("Profile.DELETE_ACCOUNT_LOADING"))).toBeTruthy();
  });
});
