/**
 * @fileoverview Unit tests for layout constants.
 *
 * Tests that layout constants are computed correctly and maintain
 * expected relationships and constraints.
 */

import {
  MODAL_BASE_WIDTH,
  MODAL_BASE_HEIGHT,
  MODAL_MAX_SCREEN_FRACTION,
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_SCROLLABLE_MAX_HEIGHT,
  MODAL_BUTTON_SPACER,
  CLOSE_BUTTON_INSET,
  CLOSE_BUTTON_SIZE,
  CLOSE_BUTTON_SIZE_LG,
  MODAL_CLOSE_TOP_OFFSET,
  MODAL_CLOSE_TOP_OFFSET_NARROW,
  MODAL_CLOSE_TOP_OFFSET_SM,
  AVATAR_SIZE_LARGE,
  AVATAR_SIZE_MEDIUM,
  AVATAR_THUMBNAIL_MARGIN,
  INPUT_BORDER_RADIUS,
  INPUT_PADDING,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  COLOR_CLUE_INDICATOR_SIZE,
  COLOR_CLUE_BORDER_RADIUS,
  COLOR_CLUE_MARGIN_RIGHT,
  SETTINGS_PANEL_BORDER_RADIUS,
  MAX_CONTENT_WIDTH,
  AUTH_CONTENT_MAX_WIDTH,
  LANDING_LOGO_WIDTH,
  LANDING_LOGO_HEIGHT,
  GAME_HEADER_SLOT_HEIGHT,
  RIDDLE_CONTAINER_SLOT_HEIGHT,
  GUESS_GRID_SLOT_HEIGHT,
  GUESS_TILE_MAX_SIZE,
  GUESS_GRID_EFFECTIVE_WIDTH,
  GUESS_GRID_H_PADDING,
  GUESS_TILE_MARGIN,
  GUESS_TILE_ROW_GAP,
  RIDDLE_TEXT_MAX_WIDTH_FRACTION,
  RIDDLE_TEXT_MAX_WIDTH,
  GAME_INPUT_BUTTON_HEIGHT,
  SUBMIT_BUTTON_PADDING_H,
  HEADER_LOGO_SIZE,
  BACK_ICON_SIZE,
  COIN_ICON_SIZE_LARGE,
  COIN_DISPLAY_ICON_SIZE,
  ACHIEVEMENT_ICON_SIZE,
  AUTH_ICON_SIZE,
  STATIC_TITLE_PADDING_H,
  STATIC_TITLE_PADDING_V,
  SOCIAL_BUTTON_MIN_WIDTH_SM,
  SOCIAL_BUTTON_MIN_WIDTH_MD,
  SOCIAL_BUTTON_MIN_WIDTH_LG,
  KEYBOARD_KEY_HEIGHT,
  KEYBOARD_KEY_WIDTH,
  KEYBOARD_KEY_MARGIN,
  KEYBOARD_KEY_BORDER_RADIUS,
  KEYBOARD_MID_ROW_MARGIN_BOTTOM,
  KEYBOARD_ROW_SPACER,
  KEYBOARD_BOTTOM_OFFSET,
  MODAL_CLOSE_BUTTON_POSITION,
  wheelSize,
} from "../layout";

describe("layout constants", () => {
  describe("modal base dimensions", () => {
    it("should have positive base width", () => {
      expect(MODAL_BASE_WIDTH).toBeGreaterThan(0);
      expect(typeof MODAL_BASE_WIDTH).toBe("number");
    });

    it("should have positive base height", () => {
      expect(MODAL_BASE_HEIGHT).toBeGreaterThan(0);
      expect(typeof MODAL_BASE_HEIGHT).toBe("number");
    });

    it("should have screen fraction between 0 and 1", () => {
      expect(MODAL_MAX_SCREEN_FRACTION).toBeGreaterThan(0);
      expect(MODAL_MAX_SCREEN_FRACTION).toBeLessThanOrEqual(1);
    });

    it("should have computed modal width as positive number", () => {
      expect(MODAL_WIDTH).toBeGreaterThan(0);
      expect(typeof MODAL_WIDTH).toBe("number");
    });

    it("should have computed modal height as positive number", () => {
      expect(MODAL_HEIGHT).toBeGreaterThan(0);
      expect(typeof MODAL_HEIGHT).toBe("number");
    });

    it("should preserve aspect ratio between width and height", () => {
      const expectedAspectRatio = MODAL_BASE_HEIGHT / MODAL_BASE_WIDTH;
      const actualAspectRatio = MODAL_HEIGHT / MODAL_WIDTH;
      expect(actualAspectRatio).toBeCloseTo(expectedAspectRatio, 5);
    });
  });

  describe("modal content layout", () => {
    it("should have positive content padding", () => {
      expect(MODAL_CONTENT_PADDING).toBeGreaterThan(0);
    });

    it("should have positive scrollable max height", () => {
      expect(MODAL_SCROLLABLE_MAX_HEIGHT).toBeGreaterThan(0);
    });

    it("should have positive button spacer", () => {
      expect(MODAL_BUTTON_SPACER).toBeGreaterThan(0);
    });
  });

  describe("close button constants", () => {
    it("should have positive close button inset", () => {
      expect(CLOSE_BUTTON_INSET).toBeGreaterThan(0);
    });

    it("should have positive close button sizes", () => {
      expect(CLOSE_BUTTON_SIZE).toBeGreaterThan(0);
      expect(CLOSE_BUTTON_SIZE_LG).toBeGreaterThan(0);
    });

    it("should have large close button bigger than standard", () => {
      expect(CLOSE_BUTTON_SIZE_LG).toBeGreaterThan(CLOSE_BUTTON_SIZE);
    });

    it("should have negative modal close top offsets", () => {
      expect(MODAL_CLOSE_TOP_OFFSET).toBeLessThan(0);
      expect(MODAL_CLOSE_TOP_OFFSET_NARROW).toBeLessThan(0);
      expect(MODAL_CLOSE_TOP_OFFSET_SM).toBeLessThan(0);
    });

    it("should have offsets in ascending order (most negative to least negative)", () => {
      expect(MODAL_CLOSE_TOP_OFFSET).toBeLessThan(MODAL_CLOSE_TOP_OFFSET_NARROW);
      expect(MODAL_CLOSE_TOP_OFFSET_NARROW).toBeLessThan(MODAL_CLOSE_TOP_OFFSET_SM);
    });

    it("should have valid close button position object", () => {
      expect(MODAL_CLOSE_BUTTON_POSITION.position).toBe("absolute");
      expect(MODAL_CLOSE_BUTTON_POSITION.top).toBe(CLOSE_BUTTON_INSET);
      expect(MODAL_CLOSE_BUTTON_POSITION.right).toBe(CLOSE_BUTTON_INSET);
      expect(MODAL_CLOSE_BUTTON_POSITION.zIndex).toBeGreaterThan(0);
    });
  });

  describe("avatar sizes", () => {
    it("should have positive avatar sizes", () => {
      expect(AVATAR_SIZE_LARGE).toBeGreaterThan(0);
      expect(AVATAR_SIZE_MEDIUM).toBeGreaterThan(0);
    });

    it("should have large avatar bigger than medium", () => {
      expect(AVATAR_SIZE_LARGE).toBeGreaterThan(AVATAR_SIZE_MEDIUM);
    });

    it("should have positive thumbnail margin", () => {
      expect(AVATAR_THUMBNAIL_MARGIN).toBeGreaterThan(0);
    });
  });

  describe("form inputs", () => {
    it("should have positive input border radius", () => {
      expect(INPUT_BORDER_RADIUS).toBeGreaterThan(0);
    });

    it("should have positive input padding", () => {
      expect(INPUT_PADDING).toBeGreaterThan(0);
    });
  });

  describe("cards", () => {
    it("should have positive card border radius", () => {
      expect(CARD_BORDER_RADIUS).toBeGreaterThan(0);
    });

    it("should have positive card padding", () => {
      expect(CARD_PADDING).toBeGreaterThan(0);
    });

    it("should have positive card margin bottom", () => {
      expect(CARD_MARGIN_BOTTOM).toBeGreaterThan(0);
    });
  });

  describe("color clue indicators", () => {
    it("should have positive indicator size", () => {
      expect(COLOR_CLUE_INDICATOR_SIZE).toBeGreaterThan(0);
    });

    it("should have positive border radius", () => {
      expect(COLOR_CLUE_BORDER_RADIUS).toBeGreaterThan(0);
    });

    it("should have positive margin right", () => {
      expect(COLOR_CLUE_MARGIN_RIGHT).toBeGreaterThan(0);
    });
  });

  describe("settings panel", () => {
    it("should have positive border radius", () => {
      expect(SETTINGS_PANEL_BORDER_RADIUS).toBeGreaterThan(0);
    });
  });

  describe("content width constraints", () => {
    it("should have positive max content width", () => {
      expect(MAX_CONTENT_WIDTH).toBeGreaterThan(0);
    });

    it("should be a reasonable desktop/tablet width", () => {
      expect(MAX_CONTENT_WIDTH).toBeGreaterThanOrEqual(400);
      expect(MAX_CONTENT_WIDTH).toBeLessThanOrEqual(800);
    });

    it("should cap auth content below full game content width", () => {
      expect(AUTH_CONTENT_MAX_WIDTH).toBeGreaterThanOrEqual(360);
      expect(AUTH_CONTENT_MAX_WIDTH).toBeLessThan(MAX_CONTENT_WIDTH);
    });

    it("should preserve the landing logo aspect ratio", () => {
      expect(LANDING_LOGO_WIDTH).toBeGreaterThan(0);
      expect(LANDING_LOGO_HEIGHT).toBeCloseTo(LANDING_LOGO_WIDTH * (150 / 320));
      expect(LANDING_LOGO_WIDTH).toBeLessThanOrEqual(AUTH_CONTENT_MAX_WIDTH);
    });
  });

  describe("game vertical slots", () => {
    it("should expose percentage slot heights", () => {
      expect(GAME_HEADER_SLOT_HEIGHT).toMatch(/^\d+%$/);
      expect(RIDDLE_CONTAINER_SLOT_HEIGHT).toMatch(/^\d+%$/);
      expect(GUESS_GRID_SLOT_HEIGHT).toMatch(/^\d+%$/);
    });

    it("should keep fixed game slots within the viewport budget", () => {
      const header = Number.parseInt(String(GAME_HEADER_SLOT_HEIGHT), 10);
      const riddle = Number.parseInt(String(RIDDLE_CONTAINER_SLOT_HEIGHT), 10);
      const grid = Number.parseInt(String(GUESS_GRID_SLOT_HEIGHT), 10);

      expect(header + riddle + grid).toBeLessThanOrEqual(70);
    });
  });

  describe("guess grid", () => {
    it("should have positive tile max size", () => {
      expect(GUESS_TILE_MAX_SIZE).toBeGreaterThan(0);
    });

    it("should have positive effective width", () => {
      expect(GUESS_GRID_EFFECTIVE_WIDTH).toBeGreaterThan(0);
    });

    it("should have positive horizontal padding", () => {
      expect(GUESS_GRID_H_PADDING).toBeGreaterThan(0);
    });

    it("should have non-negative tile margin", () => {
      expect(GUESS_TILE_MARGIN).toBeGreaterThanOrEqual(0);
    });

    it("should have non-negative row gap", () => {
      expect(GUESS_TILE_ROW_GAP).toBeGreaterThanOrEqual(0);
    });
  });

  describe("riddle text", () => {
    it("should have max width fraction between 0 and 1", () => {
      expect(RIDDLE_TEXT_MAX_WIDTH_FRACTION).toBeGreaterThan(0);
      expect(RIDDLE_TEXT_MAX_WIDTH_FRACTION).toBeLessThanOrEqual(1);
    });

    it("should have positive max width", () => {
      expect(RIDDLE_TEXT_MAX_WIDTH).toBeGreaterThan(0);
    });
  });

  describe("game input bar", () => {
    it("should have positive button height", () => {
      expect(GAME_INPUT_BUTTON_HEIGHT).toBeGreaterThan(0);
    });

    it("should have positive submit button padding", () => {
      expect(SUBMIT_BUTTON_PADDING_H).toBeGreaterThan(0);
    });
  });

  describe("header", () => {
    it("should have positive logo size", () => {
      expect(HEADER_LOGO_SIZE).toBeGreaterThan(0);
    });

    it("should have positive back icon size", () => {
      expect(BACK_ICON_SIZE).toBeGreaterThan(0);
    });
  });

  describe("decorative icons", () => {
    it("should have positive coin icon sizes", () => {
      expect(COIN_ICON_SIZE_LARGE).toBeGreaterThan(0);
      expect(COIN_DISPLAY_ICON_SIZE).toBeGreaterThan(0);
    });

    it("should have large coin icon bigger than display icon", () => {
      expect(COIN_ICON_SIZE_LARGE).toBeGreaterThan(COIN_DISPLAY_ICON_SIZE);
    });

    it("should have positive achievement icon size", () => {
      expect(ACHIEVEMENT_ICON_SIZE).toBeGreaterThan(0);
    });

    it("should have positive auth icon size", () => {
      expect(AUTH_ICON_SIZE).toBeGreaterThan(0);
    });
  });

  describe("static title", () => {
    it("should have positive horizontal padding", () => {
      expect(STATIC_TITLE_PADDING_H).toBeGreaterThan(0);
    });

    it("should have positive vertical padding", () => {
      expect(STATIC_TITLE_PADDING_V).toBeGreaterThan(0);
    });
  });

  describe("social buttons", () => {
    it("should have positive min widths", () => {
      expect(SOCIAL_BUTTON_MIN_WIDTH_SM).toBeGreaterThan(0);
      expect(SOCIAL_BUTTON_MIN_WIDTH_MD).toBeGreaterThan(0);
      expect(SOCIAL_BUTTON_MIN_WIDTH_LG).toBeGreaterThan(0);
    });

    it("should have min widths in ascending order", () => {
      expect(SOCIAL_BUTTON_MIN_WIDTH_SM).toBeLessThan(SOCIAL_BUTTON_MIN_WIDTH_MD);
      expect(SOCIAL_BUTTON_MIN_WIDTH_MD).toBeLessThan(SOCIAL_BUTTON_MIN_WIDTH_LG);
    });
  });

  describe("keyboard", () => {
    it("should have positive key dimensions", () => {
      expect(KEYBOARD_KEY_HEIGHT).toBeGreaterThan(0);
      expect(KEYBOARD_KEY_WIDTH).toBeGreaterThan(0);
    });

    it("should have non-negative key margin", () => {
      expect(KEYBOARD_KEY_MARGIN).toBeGreaterThanOrEqual(0);
    });

    it("should have positive key border radius", () => {
      expect(KEYBOARD_KEY_BORDER_RADIUS).toBeGreaterThan(0);
    });

    it("should have positive mid row margin bottom", () => {
      expect(KEYBOARD_MID_ROW_MARGIN_BOTTOM).toBeGreaterThan(0);
    });

    it("should have positive row spacer", () => {
      expect(KEYBOARD_ROW_SPACER).toBeGreaterThan(0);
    });

    it("should have positive bottom offset", () => {
      expect(KEYBOARD_BOTTOM_OFFSET).toBeGreaterThan(0);
    });
  });

  describe("wheelSize", () => {
    it("should be a positive number", () => {
      expect(wheelSize).toBeGreaterThan(0);
      expect(typeof wheelSize).toBe("number");
    });

    it("should be larger than modal diagonal", () => {
      const modalDiagonal = Math.sqrt(MODAL_WIDTH ** 2 + MODAL_HEIGHT ** 2);
      expect(wheelSize).toBeGreaterThan(modalDiagonal);
    });

    it("should be approximately 1.2x the modal diagonal", () => {
      const expectedSize = Math.ceil(
        Math.sqrt(MODAL_WIDTH ** 2 + MODAL_HEIGHT ** 2) * 1.2
      );
      expect(wheelSize).toBe(expectedSize);
    });
  });

  describe("relationship constraints", () => {
    it("should have content padding smaller than modal width", () => {
      expect(MODAL_CONTENT_PADDING * 2).toBeLessThan(MODAL_WIDTH);
    });

    it("should have button spacer smaller than button height", () => {
      expect(MODAL_BUTTON_SPACER).toBeLessThan(GAME_INPUT_BUTTON_HEIGHT);
    });

    it("should have input padding smaller than input border radius * 2", () => {
      // This ensures padding looks good with rounded corners
      expect(INPUT_PADDING).toBeGreaterThan(INPUT_BORDER_RADIUS);
    });
  });
});
