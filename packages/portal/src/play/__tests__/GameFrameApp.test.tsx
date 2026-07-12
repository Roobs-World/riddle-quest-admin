import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {GameFrameApp} from "../GameFrameApp";

describe("GameFrameApp", () => {
  it("server-renders the loading shell before host init", () => {
    const html = renderToString(<GameFrameApp />);

    expect(html).toContain("game-app");
    expect(html).toContain("Waiting for the host wrapper");
  });
});
