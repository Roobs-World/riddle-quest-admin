import type {FieldValue} from "firebase-admin/firestore";
import {type PlayerStats} from "../../../src/core/validation/index.js";

export * from "../../../src/core/validation/index.js";

/** Describes player stats update. */
export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | FieldValue;
};
