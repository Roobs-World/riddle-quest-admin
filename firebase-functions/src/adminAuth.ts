import * as admin from "firebase-admin";
import {createClerkClient, verifyToken} from "@clerk/backend";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";

type FirebaseCallableAuth = NonNullable<CallableRequest<unknown>["auth"]>;

function getClerkToken(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const token = (data as {clerkToken?: unknown}).clerkToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function getEnvList(name: string): string[] | undefined {
  const value = process.env[name];
  if (!value) return undefined;

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function getClerkVerifyOptions(): Parameters<typeof verifyToken>[1] {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
    throw new HttpsError("internal", "Clerk admin auth is not configured.");
  }

  const options: Parameters<typeof verifyToken>[1] = {};
  if (secretKey) options.secretKey = secretKey;
  if (jwtKey) options.jwtKey = jwtKey;

  const authorizedParties = getEnvList("CLERK_AUTHORIZED_PARTIES");
  if (authorizedParties) {
    options.authorizedParties = authorizedParties;
  }

  return options;
}

async function hasAdminDocument(docIds: string[]): Promise<boolean> {
  const uniqueDocIds = [...new Set(docIds.filter(Boolean))];
  if (uniqueDocIds.length === 0) return false;

  const snapshots = await Promise.all(
    uniqueDocIds.map((docId) => admin.firestore().collection("admins").doc(docId).get()),
  );

  return snapshots.some((snapshot) => snapshot.exists);
}

async function hasAdminField(field: "clerkUserId" | "email", value: string | null): Promise<boolean> {
  if (!value) return false;

  const snapshot = await admin
    .firestore()
    .collection("admins")
    .where(field, "==", value)
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function getClerkPrimaryEmail(clerkUserId: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  const clerk = createClerkClient({secretKey});
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  return email?.toLowerCase() ?? null;
}

async function requireFirebaseAdmin(auth: FirebaseCallableAuth): Promise<string> {
  if (auth.token?.admin === true) {
    return auth.uid;
  }

  const adminDoc = await admin.firestore().collection("admins").doc(auth.uid).get();
  if (adminDoc.exists) {
    return auth.uid;
  }

  throw new HttpsError("permission-denied", "This account does not have portal access.");
}

async function requireClerkAdmin(clerkToken: string): Promise<string> {
  let verifiedToken: Awaited<ReturnType<typeof verifyToken>>;
  try {
    verifiedToken = await verifyToken(clerkToken, getClerkVerifyOptions());
  } catch (error) {
    throw new HttpsError("unauthenticated", "The Clerk session could not be verified.", error);
  }

  const clerkUserId = verifiedToken.sub;
  if (!clerkUserId) {
    throw new HttpsError("unauthenticated", "The Clerk session is missing a user id.");
  }

  const customClaims = verifiedToken as Record<string, unknown>;
  if (customClaims.admin === true) {
    return `clerk:${clerkUserId}`;
  }

  if (await hasAdminDocument([`clerk:${clerkUserId}`, clerkUserId])) {
    return `clerk:${clerkUserId}`;
  }

  const email = await getClerkPrimaryEmail(clerkUserId);
  const emailIsAllowed =
    (await hasAdminDocument(email ? [email] : [])) ||
    (await hasAdminField("email", email));

  if (emailIsAllowed || (await hasAdminField("clerkUserId", clerkUserId))) {
    return email ?? `clerk:${clerkUserId}`;
  }

  throw new HttpsError("permission-denied", "This Clerk account does not have portal access.");
}

export async function requireAdmin(request: CallableRequest<unknown>): Promise<string> {
  if (request.auth) {
    return requireFirebaseAdmin(request.auth);
  }

  const clerkToken = getClerkToken(request.data);
  if (!clerkToken) {
    throw new HttpsError("unauthenticated", "Sign in with Clerk to access the management portal.");
  }

  return requireClerkAdmin(clerkToken);
}
