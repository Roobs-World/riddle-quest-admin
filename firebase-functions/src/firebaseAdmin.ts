import * as app from "firebase-admin";
import {getAuth} from "firebase-admin/auth";
import {FieldPath, FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

type FirestoreFactory = typeof getFirestore & {
  FieldPath: typeof FieldPath;
  FieldValue: typeof FieldValue;
  Timestamp: typeof Timestamp;
};

type LegacyAdmin = typeof app & {
  auth?: typeof getAuth;
  firestore?: FirestoreFactory;
  storage?: typeof getStorage;
};

const legacy = app as LegacyAdmin;
const firestore = legacy.firestore ?? (getFirestore as FirestoreFactory);

firestore.FieldPath ??= FieldPath;
firestore.FieldValue ??= FieldValue;
firestore.Timestamp ??= Timestamp;

export const admin = {
  ...app,
  auth: legacy.auth ?? getAuth,
  firestore,
  storage: legacy.storage ?? getStorage,
};
