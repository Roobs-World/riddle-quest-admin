import * as admin from "firebase-admin";

// Helper function to create a test user
export async function createUser(firestore: admin.firestore.Firestore, userId: string, data: any) {
  const userRef = firestore.collection("users").doc(userId);
  await userRef.set(data);
}
