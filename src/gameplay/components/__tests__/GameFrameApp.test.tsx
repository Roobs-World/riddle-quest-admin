import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {GameFrameApp} from "../GameFrameApp";
import {SpinningWheelLoader} from "../../../app/components/feedback/SpinningWheelLoader";

describe("GameFrameApp", () => {
  it("server-renders the loading shell before host init", () => {
    /** Provides html behavior. */
    const html = renderToString(<GameFrameApp />);

    expect(html).toContain("game-app");
    expect(html).toContain('<section class="game-loading" aria-hidden="true"></section>');
    expect(html).not.toContain('data-testid="preloader"');
    expect(html).not.toContain('data-testid="spinner-dot"');
    expect(html).toContain('class="offline-backdrop" role="alertdialog" aria-modal="true"');
    expect(html).toContain('aria-labelledby="offline-dialog-title"');
    expect(html).toContain('aria-describedby="offline-dialog-message"');
    expect(html).toContain('tabindex="-1"');
  });

  it("renders one progress-aware startup preloader", () => {
    /** Provides html behavior. */
    const html = renderToString(<SpinningWheelLoader message="Loading saved progress…" progress={58} />);

    expect(html).toContain('data-testid="preloader"');
    expect(html.match(/data-testid="spinner-dot"/g)).toHaveLength(8);
    expect(html).toContain("Loading saved progress…");
    expect(html).toContain('value="58"');
    expect(html).toContain("58%");
  });

  it("exposes Settings after a content failure without enabling answer actions", () => {
    /** Startup failure remains recoverable without claiming a loaded riddle. */
    const html = renderToString(<GameFrameApp startupError="A supported locale is required." />);
    expect(html).toContain('<p role="status">A supported locale is required.</p>');
    expect(html).toContain(">Settings</button>");
    expect(html).not.toContain('class="riddle-card"');
    expect(html).not.toContain('class="game-input-actions"');
  });

  it("makes the game surface inert while a server operation is pending", () => {
    /** Provides html behavior. */
    const html = renderToString(<GameFrameApp interactionBlocked />);

    expect(html).toContain('<main class="game-app" inert="" data-analytics-screen="game_classic">');
  });
});
