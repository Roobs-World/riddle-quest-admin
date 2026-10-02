import assert from "node:assert/strict";
import test from "node:test";
import type {RedisClient} from "@devvit/web/server";
import {CANONICAL_POST_KEY, CANONICAL_POST_PENDING, ensureCanonicalPost} from "./canonicalPost.ts";

/** Minimal provider post used only by the external SDK seam in these tests. */
type TestPost = {
  /** Provider-issued post identifier. */
  id: string;
};

/** Deterministic atomic SET NX fixture uses the pinned SDK's OK/empty reply contract. */
const fixture = () => {
  /** Installation state survives independent requests. */
  const values = new Map<string, string>();
  /** Every write is visible to tests, including its expiration policy. */
  const writes: Parameters<RedisClient["set"]>[] = [];
  /** Each GET captures the value before a competing request continues. */
  const redis: Pick<RedisClient, "get" | "set"> = {
    /** Snapshots the installation's current value. */
    async get(key: string) {return values.get(key);},
    /** Models one atomic SDK SET with its exact documented options. */
    async set(key: string, value: string, options?: Parameters<RedisClient["set"]>[2]) {
      writes.push([key, value, options]);
      if (options?.nx && values.has(key)) return "";
      values.set(key, value); return "OK";
    },
  };
  return {values, writes, redis};
};

test("overlapping install, upgrade and moderator calls submit only one canonical post", async () => {
  /** All callers share installation state, but no process-local lock. */
  const state = fixture();
  /** Counts actual calls at the external provider seam. */
  let submissions = 0;
  /** Hold the provider reply until every competing request reaches the creation boundary. */
  let finish!: (post: TestPost) => void;
  /** Held creation models provider latency without sleeps. */
  const pending = new Promise<TestPost>((resolve) => {finish = resolve;});
  /** Shared dependencies represent three independent endpoint invocations. */
  const input = {redis: state.redis, getPost: async (id: string) => ({id}),
    createPost: async () => {submissions++; return pending;}};
  /** Observe all rejected contenders immediately to prevent unhandled rejection noise. */
  const outcomes = Promise.allSettled(Array.from({length: 3}, () => ensureCanonicalPost(input)));
  await new Promise<void>((resolve) => setImmediate(resolve));
  /** No provider response has yet been delivered to any request. */
  const submittedBeforeReply = submissions;
  finish({id: "t3_canonical"});
  /** Exactly one creation owns success; contenders may retry the eventual retained post. */
  const results = await outcomes;
  assert.equal(submittedBeforeReply, 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(state.values.get(CANONICAL_POST_KEY), "t3_canonical");
  assert.deepEqual(await ensureCanonicalPost(input), {id: "t3_canonical"});
  assert.equal(submissions, 1);
});

test("an ambiguous provider failure remains pending across retries", async () => {
  /** This state belongs to one installation only. */
  const state = fixture();
  /** Failed response does not prove the provider did not create a post. */
  let submissions = 0;
  /** Simulates a connection loss after request transmission. */
  const input = {redis: state.redis, getPost: async (id: string) => ({id}),
    createPost: async (): Promise<TestPost> => {submissions++; throw new Error("provider-timeout");}};
  await assert.rejects(ensureCanonicalPost(input));
  await assert.rejects(ensureCanonicalPost(input), /canonical-post-creation-pending/);
  assert.equal(submissions, 1);
  assert.ok(state.values.has(CANONICAL_POST_KEY));
  assert.deepEqual(state.writes[0]?.[2], {nx: true});
});

test("Redis claim failure never reaches the provider creation boundary", async () => {
  /** Failures before and after committing the claim both remain safe to inspect. */
  for (const commit of [false, true]) {
    /** Isolated state for each transport outcome. */
    const state = fixture();
    /** Only the claim transport is replaced; retries use its persisted state. */
    const redis = {...state.redis,
      /** Models the claim's transport failure after optional persistence. */
      async set(key: string, value: string) {
      if (commit) state.values.set(key, value);
      throw new Error("redis-claim-timeout");
    }};
    /** Any provider call would violate the unconfirmed claim boundary. */
    const createPost = async (): Promise<TestPost> => {assert.fail("provider submission before confirmed claim");};
    await assert.rejects(ensureCanonicalPost({redis, getPost: async (id) => ({id}), createPost}), /redis-claim-timeout/);
    if (commit) await assert.rejects(ensureCanonicalPost({redis: state.redis,
      getPost: async (id) => ({id}), createPost}), /canonical-post-creation-pending/);
  }
});

test("ambiguous post persistence preserves pending or accepted state without resubmitting", async () => {
  /** Cover both sides of a lost successful Redis write response. */
  for (const commit of [false, true]) {
    /** New installation for each failure boundary. */
    const state = fixture();
    /** Provider submissions stay bounded independently of Redis reply delivery. */
    let submissions = 0;
    /** Final persistence can fail before or after its write takes effect. */
    const redis = {...state.redis,
      /** Holds the exact final write's outcome independently of its persisted state. */
      async set(...args: Parameters<RedisClient["set"]>) {
      if (args[1] === CANONICAL_POST_PENDING) return state.redis.set(...args);
      if (commit) await state.redis.set(...args);
      throw new Error("redis-result-timeout");
    }};
    /** These are the same real-provider seams used by the server entry. */
    const input = {redis, getPost: async (id: string) => ({id}),
      createPost: async () => {submissions++; return {id: "t3_saved"};}};
    await assert.rejects(ensureCanonicalPost(input), /redis-result-timeout/);
    if (commit) assert.deepEqual(await ensureCanonicalPost(input), {id: "t3_saved"});
    else await assert.rejects(ensureCanonicalPost(input), /canonical-post-creation-pending/);
    assert.equal(submissions, 1);
  }
});

test("missing retained posts and malformed records never authorize replacement", async () => {
  /** Corrupt installation state must not be deleted automatically. */
  for (const stored of ["t3_existing", "", "corrupt", CANONICAL_POST_PENDING]) {
    /** Every case preserves its exact original record. */
    const state = fixture();
    state.values.set(CANONICAL_POST_KEY, stored);
    await assert.rejects(ensureCanonicalPost({redis: state.redis,
      getPost: async () => {throw new Error("post-unavailable");},
      createPost: async (): Promise<TestPost> => {assert.fail("unexpected replacement post");}}));
    assert.equal(state.values.get(CANONICAL_POST_KEY), stored);
    assert.equal(state.writes.length, 0);
  }
});

test("a losing claim reads the winner's completed post without submitting again", async () => {
  /** Simulates the winner committing between the initial GET and the atomic SET. */
  const state = fixture();
  /** The loser receives the exact failed NX result from the pinned SDK. */
  const redis = {...state.redis,
    /** Another worker completes its post while this claim loses. */
    async set() {state.values.set(CANONICAL_POST_KEY, "t3_winner"); return "";}};
  assert.deepEqual(await ensureCanonicalPost({redis, getPost: async (id) => ({id}),
    createPost: async (): Promise<TestPost> => {assert.fail("losing request submitted");}}), {id: "t3_winner"});
});

test("invalid provider identifiers remain pending and are never cached as acceptance", async () => {
  /** The irreversible submission must not be retried after a malformed response. */
  const state = fixture();
  await assert.rejects(ensureCanonicalPost({redis: state.redis, getPost: async (id) => ({id}),
    createPost: async () => ({id: "not-a-reddit-post"})}), /invalid-canonical-post-result/);
  assert.equal(state.values.get(CANONICAL_POST_KEY), CANONICAL_POST_PENDING);
});
