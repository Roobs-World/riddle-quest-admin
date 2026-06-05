import * as admin from "firebase-admin";
import {type PlayerStats} from "@qwordly/core/validation";

export * from "@qwordly/core/validation";

export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | admin.firestore.FieldValue;
};
