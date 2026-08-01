import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {GameFrameApp} from "../GameFrameApp";
import {SpinningWheelLoader} from "../SpinningWheelLoader";

describe("GameFrameApp", () => {
  it("server-renders the loading shell before host init", () => {
    const html = renderToString(<GameFrameApp />);

    expect(html).toContain("game-app");
    expect(html).toContain('<section class="game-loading" aria-hidden="true"></section>');
    expect(html).not.toContain('data-testid="preloader"');
    expect(html).not.toContain('data-testid="spinner-dot"');
    expect(html).toContain(
      'class="offline-backdrop" role="alertdialog" aria-modal="true"><span class="spinning-wheel-graphic"',
    );
  });

  it("renders one progress-aware startup preloader", () => {
    const html = renderToString(<SpinningWheelLoader message="Loading saved progress…" progress={58} />);

    expect(html).toContain('data-testid="preloader"');
    expect(html.match(/data-testid="spinner-dot"/g)).toHaveLength(8);
    expect(html).toContain("Loading saved progress…");
    expect(html).toContain('value="58"');
    expect(html).toContain("58%");
  });

  it("makes the game surface inert while a server operation is pending", () => {
    const html = renderToString(<GameFrameApp interactionBlocked />);

    expect(html).toContain('<main class="game-app" inert="" data-analytics-screen="game_classic">');
  });
});
