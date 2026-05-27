import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
} from "@react-native-firebase/firestore";
import {ZodType} from "zod";
import {
  FirestoreRiddle,
  FirestoreRiddleSchema,
  Player,
  PlayerSchema,
  ProductPricing,
  ProductPricingSchema,
} from "../validation/firestoreSchemas";

type FirestoreRefWithConverter = {
  withConverter: (converter: FirestoreDataConverter<unknown, DocumentData>) => unknown;
};

const hasWithConverter = (value: unknown): value is FirestoreRefWithConverter =>
  typeof value === "object" &&
  value !== null &&
  "withConverter" in value &&
  typeof (value as FirestoreRefWithConverter).withConverter === "function";

const withDocumentIdFallback =
  (fieldName: string) =>
  (data: DocumentData, id: string): DocumentData => ({
    ...data,
    [fieldName]: typeof data[fieldName] === "string" && data[fieldName].length > 0 ? data[fieldName] : id,
  });

const createZodFirestoreConverter = <T>(
  schema: ZodType<T>,
  normalize: (data: DocumentData, id: string) => DocumentData,
): FirestoreDataConverter<T, DocumentData> => ({
  toFirestore(modelObject: WithFieldValue<T>): WithFieldValue<DocumentData> {
    return modelObject as WithFieldValue<DocumentData>;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData, DocumentData>, options?: SnapshotOptions): T {
    return schema.parse(normalize(snapshot.data(options), snapshot.id));
  },
});

export const playerFirestoreConverter = createZodFirestoreConverter<Player>(
  PlayerSchema,
  withDocumentIdFallback("userId"),
);

export const riddleFirestoreConverter = createZodFirestoreConverter<FirestoreRiddle>(
  FirestoreRiddleSchema,
  withDocumentIdFallback("riddleId"),
);

export const productPricingFirestoreConverter = createZodFirestoreConverter<ProductPricing>(
  ProductPricingSchema,
  withDocumentIdFallback("productId"),
);

export const withConverterIfAvailable = <TRef, TModel>(
  ref: TRef,
  converter: FirestoreDataConverter<TModel, DocumentData>,
): TRef =>
  hasWithConverter(ref) ? (ref.withConverter(converter as FirestoreDataConverter<unknown, DocumentData>) as TRef) : ref;
