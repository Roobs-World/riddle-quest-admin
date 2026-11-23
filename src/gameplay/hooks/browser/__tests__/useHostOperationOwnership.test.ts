import {beforeEach, expect, it, jest} from "@jest/globals";

/** Hook state persists across controlled account-owner renders. */
const mockStates: unknown[] = [];
/** Reference cells retain the latest owner independently of callback identity. */
const mockRefs: Array<{
  /** Hook-owned mutable cell. */
  current: unknown;
}> = [];
/** State and reference positions reset in the same order on every render. */
let mockStateIndex = 0, mockRefIndex = 0;
jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useRef: (initial: unknown) => {
    /** Stable mutable hook cell used by the actual operation module. */
    const index = mockRefIndex++;
    return mockRefs[index] ?? (mockRefs[index] = {current: initial});
  },
  useState: (initial: unknown) => {
    /** Stable state position used across account replacement renders. */
    const index = mockStateIndex++;
    if (!(index in mockStates)) mockStates[index] = typeof initial === "function" ? initial() : initial;
    return [mockStates[index], (update: unknown) => {mockStates[index] = typeof update === "function" ? update(mockStates[index]) : update;}];
  },
}));
jest.mock("../../../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));
import {useHostOperations} from "../useHostOperations";

/** Operation completion is controlled independently of account replacement. */
const deferred = () => {
  /** Completes the held authority operation after a selected ownership change. */
  let resolve!: () => void;
  /** Pending work admitted under one account visit. */
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
};
/** Latest rendered owner drives the actual operation hook's global activity projection. */
const render = (owner: object) => {
  mockStateIndex = 0;mockRefIndex = 0;
  /** Extra ownership configuration is ignored by the baseline hook, reproducing its leak. */
  const options = {postOperation: jest.fn(), owner};
  return useHostOperations(options);
};

beforeEach(() => {mockStates.length = 0;mockRefs.length = 0;mockStateIndex = 0;mockRefIndex = 0;});

it("releases the previous account's activity immediately when its operation stays pending", async () => {
  /** Distinct visit identities do not depend on matching or different UIDs. */
  const alice = {}, bob = {}, held = deferred();
  /** Original operation blocks only its original mounted account visit. */
  const pending = render(alice).withActivity(() => held.promise);
  expect(render(alice).activityActive).toBe(true);
  try {expect(render(bob).activityActive).toBe(false);} finally {held.resolve();await pending;}
});

it("does not let a retired operation remove the replacement account's activity", async () => {
  /** Both visits retain independent pending authority work. */
  const alice = {}, bob = {}, older = deferred(), newer = deferred();
  /** The original operation remains pending as the replacement starts its own read. */
  const original = render(alice).withActivity(() => older.promise);
  /** New operation owns the replacement's activity projection. */
  const current = render(bob).withActivity(() => newer.promise);
  expect(render(bob).activityActive).toBe(true);
  older.resolve();await original;
  expect(render(bob).activityActive).toBe(true);
  newer.resolve();await current;
  expect(render(bob).activityActive).toBe(false);
});

it("keeps concurrent operations counted within one account visit", async () => {
  /** Same-account work can finish independently without prematurely releasing the overlay. */
  const owner = {}, first = deferred(), second = deferred();
  /** Current visit owns both pending operations. */
  const operations = render(owner);
  /** Independent completions preserve the remaining active count. */
  const older = operations.withActivity(() => first.promise), newer = operations.withActivity(() => second.promise);
  first.resolve();await older;
  expect(render(owner).activityActive).toBe(true);
  second.resolve();await newer;
  expect(render(owner).activityActive).toBe(false);
});

it("does not carry activity into a later visit of the same account", async () => {
  /** Re-entry gets a fresh ownership token even when the platform UID is unchanged. */
  const firstVisit = {}, signedOut = {}, secondVisit = {}, held = deferred();
  /** The held first visit cannot block sign-out or re-entry. */
  const pending = render(firstVisit).withActivity(() => held.promise);
  render(signedOut);
  try {expect(render(secondVisit).activityActive).toBe(false);} finally {held.resolve();await pending;}
});
