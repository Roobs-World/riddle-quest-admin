import type {RedisClient} from "@devvit/web/server";

/** Installation-scoped post reference; this never stores account or economy state. */
export const CANONICAL_POST_KEY = "riddle-quest:canonical-post:v1";
/** No automatic expiry: a lost provider response must not authorize another post submission. */
export const CANONICAL_POST_PENDING = "creation-pending:v1";
/** Accepts only Reddit post identifiers returned by the provider. */
const isPostId = (value: string): value is `t3_${string}` => /^t3_[a-z0-9]{1,20}$/u.test(value);

/** Reuses the installation's game post across lifecycle and moderator requests. */
export async function ensureCanonicalPost<Post extends {
  /** Provider-issued post identifier. */
  id: string;
}>(input: {
  /** Real installation-scoped Devvit Redis adapter. */ redis: Pick<RedisClient, "get" | "set">;
  /** Real Reddit SDK read for the retained post. */ getPost(id: `t3_${string}`): Promise<Post>;
  /** Real Reddit SDK creation configured for this installation and app entry. */ createPost(): Promise<Post>;
}): Promise<Post> {
  /** Existing installations retain their original post key. */
  const existingId = await input.redis.get(CANONICAL_POST_KEY);
  if (existingId !== undefined) {
    if (isPostId(existingId)) return input.getPost(existingId);
    throw new Error(existingId === CANONICAL_POST_PENDING ? "canonical-post-creation-pending" : "invalid-canonical-post-record");
  }
  // Only one distributed request may cross the provider creation boundary.
  // Keep this marker on any ambiguous failure, including a lost Redis response.
  if (await input.redis.set(CANONICAL_POST_KEY, CANONICAL_POST_PENDING, {nx: true}) !== "OK") {
    /** The winning request may have persisted its provider result before this read. */
    const winner = await input.redis.get(CANONICAL_POST_KEY);
    if (winner !== undefined && isPostId(winner)) return input.getPost(winner);
    throw new Error("canonical-post-creation-pending");
  }
  /** The provider owns post creation and its returned identifier. */
  const post = await input.createPost();
  if (!isPostId(post.id)) throw new Error("invalid-canonical-post-result");
  if (await input.redis.set(CANONICAL_POST_KEY, post.id) !== "OK") throw new Error("canonical-post-persistence-failed");
  return post;
}
