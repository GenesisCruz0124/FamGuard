// Background location task runs in its own JS context, so it can't read
// React state — session info is persisted here and mirrored in memory.
import * as SecureStore from "expo-secure-store";

const UID_KEY = "famguard.uid";
const FAMILY_ID_KEY = "famguard.familyId";
const SHARING_PAUSED_KEY = "famguard.sharingPaused";

export async function setCurrentUid(uid: string | null) {
  if (uid) await SecureStore.setItemAsync(UID_KEY, uid);
  else await SecureStore.deleteItemAsync(UID_KEY);
}

export async function getCurrentUid(): Promise<string | null> {
  return SecureStore.getItemAsync(UID_KEY);
}

export async function setCurrentFamilyId(familyId: string | null) {
  if (familyId) await SecureStore.setItemAsync(FAMILY_ID_KEY, familyId);
  else await SecureStore.deleteItemAsync(FAMILY_ID_KEY);
}

export async function getCurrentFamilyId(): Promise<string | null> {
  return SecureStore.getItemAsync(FAMILY_ID_KEY);
}

export async function setSharingPaused(paused: boolean) {
  await SecureStore.setItemAsync(SHARING_PAUSED_KEY, paused ? "1" : "0");
}

export async function getSharingPaused(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(SHARING_PAUSED_KEY);
  return value === "1";
}
