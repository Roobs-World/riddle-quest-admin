import * as admin from "firebase-admin";
import {type PlayerStats} from "../../../packages/core/dist/validation";

export * from "../../../packages/core/dist/validation";

export type PlayerStatsUpdate = {
  [key in keyof PlayerStats]?: PlayerStats[key] | admin.firestore.FieldValue;
};
