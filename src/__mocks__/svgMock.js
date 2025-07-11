import React from "react";

// SVG Mock that returns a functional React component
const SvgMock = React.forwardRef((props, ref) => {
  return React.createElement("svg", {
    ...props,
    ref,
    "data-testid": props["data-testid"] || "svg-mock",
  });
});

SvgMock.displayName = "SvgMock";

export default SvgMock;
