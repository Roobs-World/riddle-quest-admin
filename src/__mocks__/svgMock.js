import React from "react";

// SVG Mock - returns a functional React component (svg works in jsdom)
const SvgMock = React.forwardRef((props, ref) => {
  return React.createElement("svg", {
    ...props,
    ref,
    "data-testid": props["data-testid"] || "svg-mock",
  });
});

SvgMock.displayName = "SvgMock";

export default SvgMock;
