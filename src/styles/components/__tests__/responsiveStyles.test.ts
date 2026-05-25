import {responsiveTestProfileList, withResponsiveProfile} from "../../../test-utils/responsiveTestHarness";

describe("responsive component styles", () => {
  it.each(responsiveTestProfileList)("uses responsive content constraints for $name", (profile) => {
    const {constants, layoutStyles, modalStyles} = withResponsiveProfile(profile, () => {
      const constantsModule = require("../../../constants/layout");
      const layoutModule = require("../layout");
      const modalModule = require("../modals");

      return {
        constants: constantsModule,
        layoutStyles: layoutModule.layoutStyles,
        modalStyles: modalModule.modalStyles,
      };
    });

    expect(layoutStyles.authContentContainer.maxWidth).toBe(constants.AUTH_CONTENT_MAX_WIDTH);
    expect(layoutStyles.authContentContainer.width).toBe("100%");
    expect(layoutStyles.centerContainerTablet.maxWidth).toBe(constants.MAX_CONTENT_WIDTH);
    expect(layoutStyles.gameContainerLargeTablet.maxWidth).toBe(constants.MAX_CONTENT_WIDTH);
    expect(layoutStyles.gameContainerDesktop.maxWidth).toBe(constants.MAX_CONTENT_WIDTH);
    expect(layoutStyles.gameInput.flexShrink).toBe(0);

    expect(modalStyles.content.maxHeight).toBe(constants.MODAL_MAX_HEIGHT);
    expect(modalStyles.content.maxHeight).toBeLessThanOrEqual(profile.screenHeight * 0.88);
    expect(modalStyles.content.maxWidth).toBe(constants.AUTH_CONTENT_MAX_WIDTH);
    expect(modalStyles.content.width).toBe("90%");
    expect(modalStyles.contentScrollable.maxHeight).toBe(constants.MODAL_MAX_HEIGHT * 0.82);
    expect(modalStyles.modalContainer.maxWidth).toBe(constants.AUTH_CONTENT_MAX_WIDTH);
    expect(modalStyles.modalContainer.width).toBe("90%");
  });
});
