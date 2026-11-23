import type {FieldValue} from "firebase-admin/firestore";
import {type PlayerStats} from "@riddle-quest/core/validation";

export * from "@riddle-quest/core/validation";

/** Describes player stats update. */
export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | FieldValue;
};
