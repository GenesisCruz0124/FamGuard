import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "famguard.consentGiven";

export async function setConsentGiven(given: boolean) {
  await SecureStore.setItemAsync(CONSENT_KEY, given ? "1" : "0");
}

export async function getConsentGiven(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CONSENT_KEY)) === "1";
}
