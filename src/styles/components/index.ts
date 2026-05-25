/**
 * Component Styles Index
 * Aggregates all component styles into a single styles object
 */

import {layoutStyles} from "./layout";
import {buttonStyles} from "./buttons";
import {textStyles} from "./text";
import {modalStyles} from "./modals";
import {gameStyles} from "./game";
import {formStyles} from "./forms";
import {animationStyles} from "./animations";

// Combine all component styles into a single styles object
export const styles = {
  ...layoutStyles,
  ...buttonStyles,
  ...textStyles,
  ...modalStyles,
  ...gameStyles,
  ...formStyles,
  ...animationStyles,
};

// Also export individual style modules for specific imports
export {layoutStyles, buttonStyles, textStyles, modalStyles, gameStyles, formStyles, animationStyles};
