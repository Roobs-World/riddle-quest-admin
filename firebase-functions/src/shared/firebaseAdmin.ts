import * as app from "firebase-admin";
import {getAuth} from "firebase-admin/auth";
import {FieldPath, FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {getDatabase} from "firebase-admin/database";

/** Describes firestore factory. */
type FirestoreFactory = typeof getFirestore & {
  /** Stores field path. */
  FieldPath: typeof FieldPath;
  /** Stores field value. */
  FieldValue: typeof FieldValue;
  /** Stores timestamp. */
  Timestamp: typeof Timestamp;
};

/** Describes legacy admin. */
type LegacyAdmin = typeof app & {
  /** Stores auth. */
  auth?: typeof getAuth;
  /** Stores firestore. */
  firestore?: FirestoreFactory;
  /** Stores storage. */
  storage?: typeof getStorage;
  /** Stores database. */
  database?: typeof getDatabase;
};

/** Provides legacy behavior. */
const legacy = app as LegacyAdmin;
/** Provides firestore behavior. */
const firestore = legacy.firestore ?? (getFirestore as FirestoreFactory);

firestore.FieldPath ??= FieldPath;
firestore.FieldValue ??= FieldValue;
firestore.Timestamp ??= Timestamp;

/** Provides admin behavior. */
export const admin = {
  ...app,
  auth: legacy.auth ?? getAuth,
  firestore,
  storage: legacy.storage ?? getStorage,
  database: legacy.database ?? getDatabase,
};
