import React from "react";
import { render } from "@testing-library/react-native";

const mockCloseSvg = jest.fn(() => null);

jest.mock("@images/close-white.svg", () => {
  return (props: any) => mockCloseSvg(props);
});

import CloseIconWhite from "../CloseIconWhite";

describe("CloseIconWhite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders default size", () => {
    render(<CloseIconWhite />);

    expect(mockCloseSvg).toHaveBeenCalledWith(
      expect.objectContaining({ width: 18, height: 18 }),
    );
  });

  it("renders custom width and height", () => {
    render(<CloseIconWhite width="24" height={30} />);

    expect(mockCloseSvg).toHaveBeenCalledWith(
      expect.objectContaining({ width: "24", height: 30 }),
    );
  });
});
