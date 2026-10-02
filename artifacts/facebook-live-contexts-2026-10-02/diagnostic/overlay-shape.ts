import type {FacebookOverlayView} from "../../../packages/portal/src/facebook/fbinstant";
/** Minimal lifecycle documented by Meta, with no destruction extension. */
const documented: FacebookOverlayView = {showAsync: async () => {}, dismissAsync: async () => {}};
void documented;
