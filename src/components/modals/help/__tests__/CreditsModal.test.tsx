import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import CreditsModal from "../CreditsModal";

describe("CreditsModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when visible", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    expect(screen.getByText("Credits")).toBeTruthy();
    expect(
      screen.getByText("Meet the amazing team behind Qwordly")
    ).toBeTruthy();
    expect(screen.getByText("Craig Beswetherick")).toBeTruthy();
    expect(screen.getByText("Lead Developer & Game Design")).toBeTruthy();
    expect(screen.getByText("Thomas Lemrond")).toBeTruthy();
    expect(
      screen.getByText("Game Designer, Publisher, Overall Hero")
    ).toBeTruthy();
    expect(screen.getByText("Thank You!")).toBeTruthy();
    expect(screen.getByText("Got It!")).toBeTruthy();
  });

  it("does not render when not visible", () => {
    render(<CreditsModal isVisible={false} onClose={mockOnClose} />);

    expect(screen.queryByText("Credits")).toBeNull();
  });

  it("calls onClose when close button is pressed", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button");
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Got It button is pressed", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    const gotItButton = screen.getByText("Got It!");
    fireEvent.press(gotItButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("displays all team members correctly", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    // Check for all team members
    const expectedMembers = [
      "Craig Beswetherick",
      "Reuben Beswetherick",
      "Thomas Lemrond",
      "Gavin Harrison",
      "Nathalia",
      "Mr Ben",
    ];

    expectedMembers.forEach((member) => {
      expect(screen.getByText(member)).toBeTruthy();
    });
  });

  it("displays thank you message", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    expect(
      screen.getByText(
        "Special thanks to all our contributors who made Qwordly possible. Your creativity, dedication, and passion brought this project to life."
      )
    ).toBeTruthy();
  });
});
