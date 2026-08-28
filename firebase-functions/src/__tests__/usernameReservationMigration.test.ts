import {describe, expect, it} from "@jest/globals";
import type {Firestore} from "firebase-admin/firestore";
import {
  MAX_USERNAME_MIGRATION_PAGE_SIZE,
  migrateUsernameReservationPage,
} from "../profile/usernameReservationMigration";
import {createUsernameReservationId} from "../profile/usernameReservations";

/** Describes data. */
type Data = Record<string, unknown>;
/** Defines the contract for fake ref. */
interface FakeRef {
  /** Stores id. */
  id: string;
  /** Stores path. */
  path: string;
  /** Provides get behavior. */
  get(): Promise<unknown>;
  /** Provides set behavior. */
  set(
    data: Data,
    options?: {
      /** Stores merge. */
      merge?: boolean;
    },
  ): Promise<void>;
}

/** Creates a stateful Firestore subset sufficient to exercise the real migration. */
function createFakeFirestore(seed: Record<string, Data> = {}) {
  /** Provides documents behavior. */
  const documents = new Map<string, Data>(Object.entries(seed));
  /** Provides snapshot behavior. */
  const snapshot = (ref: {
    /** Stores id. */ /** Stores id. */
    id: string; /** Stores path. */ /** Stores path. */
    /** Stores path. */
    path: string;
  }) => {
    /** Provides data behavior. */
    const data = documents.get(ref.path);
    return {exists: data !== undefined, id: ref.id, ref, data: () => data};
  };
  /** Provides doc behavior. */
  const doc = (collectionName: string, id: string) => {
    /** Provides ref behavior. */
    const ref = {
      id,
      path: `${collectionName}/${id}`,
      get: async () => snapshot(ref),
      set: async (
        data: Data,
        options?: {
          /** Stores merge. */
          merge?: boolean;
        },
      ) => {
        documents.set(ref.path, options?.merge ? {...documents.get(ref.path), ...data} : data);
      },
    };
    return ref;
  };
  /** Provides collection behavior. */
  const collection = (collectionName: string) => ({
    doc: (id: string) => doc(collectionName, id),
    orderBy: () => ({
      limit: (pageSize: number) => {
        /** Provides cursor behavior. */
        let cursor: string | undefined;
        /** Provides query behavior. */
        const query = {
          startAfter: (value: string) => {
            cursor = value;
            return query;
          },
          get: async () => {
            /** Provides prefix behavior. */
            const prefix = `${collectionName}/`;
            /** Provides docs behavior. */
            const docs = [...documents.keys()]
              .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
              .map((path) => path.slice(prefix.length))
              .filter((id) => cursor === undefined || id > cursor)
              .sort()
              .slice(0, pageSize)
              .map((id) => snapshot(doc(collectionName, id)));
            return {empty: docs.length === 0, docs};
          },
        };
        return query;
      },
    }),
  });
  /** Provides transaction behavior. */
  const transaction = {
    get: async (ref: FakeRef) => snapshot(ref),
    set: (
      ref: FakeRef,
      data: Data,
      options?: {
        /** Stores merge. */
        merge?: boolean;
      },
    ) => {
      documents.set(ref.path, options?.merge ? {...documents.get(ref.path), ...data} : data);
    },
    update: (ref: FakeRef, data: Data) => {
      /** Provides current behavior. */
      const current = documents.get(ref.path);
      if (!current) throw new Error(`Missing document ${ref.path}`);
      documents.set(ref.path, {...current, ...data});
    },
    delete: (ref: FakeRef) => documents.delete(ref.path),
  };
  /** Provides db behavior. */
  const db = {
    collection,
    runTransaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction),
  };
  return {db: db as unknown as Firestore, documents};
}

describe("username reservation migration", () => {
  it("advances a bounded cursor and opens the gate only on the final empty page", async () => {
    /** Provides {db, documents} behavior. */
    const {db, documents} = createFakeFirestore({
      "users/a": {username: "Alpha"},
      "users/b": {username: "Bravo"},
      "users/c": {username: "Charlie"},
    });

    await expect(migrateUsernameReservationPage(db, 2)).resolves.toEqual({
      complete: false,
      lastUserId: "b",
      processed: 2,
    });
    expect(documents.get("usernameReservationMigrations/v1")).toMatchObject({complete: false, lastUserId: "b"});
    expect(documents.get("leaderboard/a")).toMatchObject({userId: "a", subjectUserId: "a", username: "Alpha"});
    expect(documents.get("leaderboard/b")).toMatchObject({userId: "b", subjectUserId: "b", username: "Bravo"});
    await expect(migrateUsernameReservationPage(db, 2)).resolves.toEqual({
      complete: false,
      lastUserId: "c",
      processed: 1,
    });
    expect(documents.get("usernameReservationMigrations/v1")).toMatchObject({complete: false, lastUserId: "c"});
    await expect(migrateUsernameReservationPage(db, 2)).resolves.toEqual({
      complete: true,
      lastUserId: "c",
      processed: 0,
    });
    expect(documents.get("usernameReservationMigrations/v1")).toMatchObject({complete: true});
  });

  it("is idempotent when an owned reservation is replayed before cursor persistence", async () => {
    /** Provides reservation id behavior. */
    const reservationId = createUsernameReservationId("Ada");
    /** Provides {db, documents} behavior. */
    const {db, documents} = createFakeFirestore({
      "users/user-a": {username: "Ada"},
      [`usernameReservations/${reservationId}`]: {userId: "user-a", username: "Ada"},
    });

    await expect(migrateUsernameReservationPage(db, 1)).resolves.toMatchObject({processed: 1});
    documents.delete("usernameReservationMigrations/v1");
    await expect(migrateUsernameReservationPage(db, 1)).resolves.toMatchObject({processed: 1});
    expect(documents.get(`usernameReservations/${reservationId}`)).toMatchObject({userId: "user-a"});
  });

  it("halts on a legacy case-variant collision without advancing past the loser", async () => {
    /** Provides {db, documents} behavior. */
    const {db, documents} = createFakeFirestore({
      "users/a": {username: "Ada"},
      "users/b": {username: "ada"},
    });

    await expect(migrateUsernameReservationPage(db, 1)).resolves.toMatchObject({lastUserId: "a", processed: 1});
    /** Provides state before collision behavior. */
    const stateBeforeCollision = documents.get("usernameReservationMigrations/v1");
    await expect(migrateUsernameReservationPage(db, 1)).rejects.toMatchObject({code: "already-exists"});
    expect(documents.get("usernameReservationMigrations/v1")).toMatchObject({complete: false, lastUserId: "a"});
    expect(documents.get("usernameReservationMigrations/v1")).toEqual(stateBeforeCollision);
    expect(documents.get("users/b")).not.toHaveProperty("usernameReservationId");
  });

  it("halts on an invalid legacy username without advancing the cursor", async () => {
    /** Provides {db, documents} behavior. */
    const {db, documents} = createFakeFirestore({"users/a": {username: "___"}});

    await expect(migrateUsernameReservationPage(db, 1)).rejects.toMatchObject({code: "failed-precondition"});
    expect(documents.has("usernameReservationMigrations/v1")).toBe(false);
    expect(documents.get("users/a")).toEqual({username: "___"});
  });

  it("rejects unbounded or invalid page sizes", async () => {
    /** Provides {db} behavior. */
    const {db} = createFakeFirestore();
    await expect(migrateUsernameReservationPage(db, 0)).rejects.toThrow("pageSize");
    await expect(migrateUsernameReservationPage(db, MAX_USERNAME_MIGRATION_PAGE_SIZE + 1)).rejects.toThrow("pageSize");
    await expect(migrateUsernameReservationPage(db, 1.5)).rejects.toThrow("pageSize");
  });
});
