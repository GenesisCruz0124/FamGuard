import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";

import { db } from "./firebase";
import type { UserDoc } from "@/types";

const TRIAL_DAYS = 14;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

const ACTIVATED_KEY = "famguard.activated";

export function getDeviceId(): string | null {
  return Application.getAndroidId();
}

export function isTrialExpired(trialStartedAt: number | undefined): boolean {
  if (!trialStartedAt) return false;
  return Date.now() - trialStartedAt > TRIAL_MS;
}

export function trialDaysRemaining(trialStartedAt: number | undefined): number {
  if (!trialStartedAt) return TRIAL_DAYS;
  const remainingMs = TRIAL_MS - (Date.now() - trialStartedAt);
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function isGatedFeatureBlocked(userDoc: Pick<UserDoc, "trialStartedAt" | "activation"> | null): boolean {
  if (!userDoc) return false;
  if (userDoc.activation?.activated) return false;
  return isTrialExpired(userDoc.trialStartedAt);
}

export async function setLocalActivated(activated: boolean) {
  await SecureStore.setItemAsync(ACTIVATED_KEY, activated ? "1" : "0");
}

export async function getLocalActivated(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ACTIVATED_KEY)) === "1";
}

export type RedeemResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "bound_to_other_device" | "error" };

export async function redeemActivationCode(code: string, uid: string): Promise<RedeemResult> {
  const deviceId = getDeviceId();
  if (!deviceId) return { ok: false, reason: "error" };

  const normalizedCode = code.trim().toUpperCase();
  const codeRef = db.collection("activationCodes").doc(normalizedCode);
  try {
    const snap = await codeRef.get();
    if (!snap.exists) return { ok: false, reason: "not_found" };

    const data = snap.data() as { deviceId: string | null; boundUid: string | null };
    if (data.deviceId && data.deviceId !== deviceId) {
      return { ok: false, reason: "bound_to_other_device" };
    }

    await codeRef.update({
      deviceId,
      boundUid: uid,
      usedAt: Date.now(),
    });

    await db.collection("users").doc(uid).update({
      activation: { activated: true, deviceId, code: normalizedCode, activatedAt: Date.now() },
    });
    await setLocalActivated(true);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
