import React from "react";
import { render } from "@testing-library/react-native";
import { Image } from "react-native";
import XIcon from "../XIcon";

describe("XIcon", () => {
  it("renders with default size", () => {
    const { UNSAFE_getByType } = render(<XIcon />);
    const image = UNSAFE_getByType(Image);

    expect(image.props.style).toMatchObject({
      width: 24,
      height: 24,
      resizeMode: "contain",
    });
  });

  it("renders with numeric width", () => {
    const { UNSAFE_getByType } = render(<XIcon width={32} />);
    const image = UNSAFE_getByType(Image);

    expect(image.props.style).toMatchObject({
      width: 32,
      height: 32,
    });
  });

  it("parses string width and applies tint color", () => {
    const { UNSAFE_getByType } = render(<XIcon width="40" tintColor="#fff" />);
    const image = UNSAFE_getByType(Image);

    expect(image.props.style).toMatchObject({
      width: 40,
      height: 40,
      tintColor: "#fff",
    });
  });
});
