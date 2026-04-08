import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import CreditsModal from "../CreditsModal";

// Mock SVG component
jest.mock("../../../../assets/images/home-bg.svg", () => "HomeBgSvg");

describe("CreditsModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when visible", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    expect(screen.getByText("Credits")).toBeTruthy();
    expect(screen.getByText("Craig Beswetherick")).toBeTruthy();
    expect(screen.getByText("Lead Developer & Game Design")).toBeTruthy();
    expect(screen.getByText("Thomas Lemrond")).toBeTruthy();
    expect(
      screen.getByText("Game Designer, Publisher, Overall Hero")
    ).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("does not render when not visible", () => {
    render(<CreditsModal isVisible={false} onClose={mockOnClose} />);

    // Modal is not visible so we shouldn't find this text
    expect(screen.queryByText("Credits")).toBeNull();
  });

  it("calls onClose when close button (X) is pressed", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText("Close");
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Close button is pressed", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    const closeButton = screen.getByText("Close");
    fireEvent.press(closeButton);

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

  it("displays team member roles", () => {
    render(<CreditsModal isVisible={true} onClose={mockOnClose} />);

    expect(screen.getByText("Inspiration")).toBeTruthy();
    expect(screen.getByText("Sound Design")).toBeTruthy();
    expect(screen.getAllByText("Design").length).toBeGreaterThanOrEqual(1);
  });
});
