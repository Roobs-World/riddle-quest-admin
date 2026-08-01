import type {FieldValue} from "firebase-admin/firestore";
import {type PlayerStats} from "@qwordly/core/validation";

export * from "@qwordly/core/validation";

export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | FieldValue;
};
