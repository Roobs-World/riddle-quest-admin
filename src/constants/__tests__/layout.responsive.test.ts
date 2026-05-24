import {
  responsiveTestProfileList,
  withResponsiveProfile,
  type ResponsiveTestProfile,
} from "../../test-utils/responsiveTestHarness";

type LayoutModule = typeof import("../layout");

const loadLayoutForProfile = (profile: ResponsiveTestProfile): LayoutModule =>
  withResponsiveProfile(profile, () => require("../layout") as LayoutModule);

describe("layout constants across responsive device profiles", () => {
  it.each(responsiveTestProfileList)("%s keeps modal dimensions inside the viewport", (profile) => {
    const layout = loadLayoutForProfile(profile);

    expect(layout.MODAL_WIDTH).toBeLessThanOrEqual(
      profile.screenWidth * layout.MODAL_MAX_SCREEN_FRACTION,
    );
    expect(layout.MODAL_HEIGHT / layout.MODAL_WIDTH).toBeCloseTo(
      layout.MODAL_BASE_HEIGHT / layout.MODAL_BASE_WIDTH,
      5,
    );
    expect(layout.MODAL_MAX_HEIGHT).toBeCloseTo(
      profile.screenHeight * layout.MODAL_MAX_SCREEN_HEIGHT_FRACTION,
    );
    expect(layout.getResponsiveModalHeight(10)).toBeLessThanOrEqual(layout.MODAL_MAX_HEIGHT);
  });

  it.each(responsiveTestProfileList)("%s constrains auth and landing content", (profile) => {
    const layout = loadLayoutForProfile(profile);

    expect(layout.AUTH_CONTENT_MAX_WIDTH).toBeLessThan(layout.MAX_CONTENT_WIDTH);
    expect(layout.LANDING_LOGO_WIDTH).toBeLessThanOrEqual(layout.AUTH_CONTENT_MAX_WIDTH);
    expect(layout.LANDING_LOGO_WIDTH).toBeLessThanOrEqual(profile.screenWidth * 0.82);
    expect(layout.LANDING_LOGO_HEIGHT).toBeCloseTo(layout.LANDING_LOGO_WIDTH * (150 / 320));
  });

  it.each(responsiveTestProfileList)("%s keeps game slots in a stable vertical budget", (profile) => {
    const layout = loadLayoutForProfile(profile);
    const header = Number.parseInt(String(layout.GAME_HEADER_SLOT_HEIGHT), 10);
    const riddle = Number.parseInt(String(layout.RIDDLE_CONTAINER_SLOT_HEIGHT), 10);
    const grid = Number.parseInt(String(layout.GUESS_GRID_SLOT_HEIGHT), 10);

    expect(header + riddle + grid).toBeLessThanOrEqual(70);
    if (profile.expectedTier === "largeTablet") {
      expect(layout.GUESS_GRID_EFFECTIVE_WIDTH).toBeLessThanOrEqual(layout.MAX_CONTENT_WIDTH);
    } else {
      expect(layout.GUESS_GRID_EFFECTIVE_WIDTH).toBeLessThanOrEqual(profile.screenWidth);
    }

    if (profile.expectedTier === "largeTablet") {
      expect(layout.RIDDLE_CONTAINER_SLOT_HEIGHT).toBe("26%");
      expect(layout.GUESS_GRID_SLOT_HEIGHT).toBe("32%");
    } else if (profile.expectedTier === "tablet") {
      expect(layout.RIDDLE_CONTAINER_SLOT_HEIGHT).toBe("24%");
      expect(layout.GUESS_GRID_SLOT_HEIGHT).toBe("34%");
    } else {
      expect(layout.RIDDLE_CONTAINER_SLOT_HEIGHT).toBe("20%");
      expect(layout.GUESS_GRID_SLOT_HEIGHT).toBe("36%");
    }
  });
});
