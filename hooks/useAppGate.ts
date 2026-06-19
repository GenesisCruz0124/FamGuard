import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { getConsentGiven } from "@/lib/consent";
import { useAuth } from "@/lib/auth";

// Routes the user to the first incomplete step: consent -> sign-in ->
// create/join family -> the main tabs. Runs on every segment change so
// deep-linking into the middle of the flow still lands somewhere valid.
export function useAppGate() {
  const { uid, userDoc, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    getConsentGiven().then((given) => {
      setHasConsent(given);
      setConsentChecked(true);
    });
  }, []);

  useEffect(() => {
    if (initializing || !consentChecked) return;

    const inOnboarding = segments[0] === "onboarding";
    const inAuth = segments[0] === "auth";
    const inFamilySetup = segments[0] === "family";

    if (!hasConsent && !inOnboarding) {
      router.replace("/onboarding/consent");
      return;
    }
    if (hasConsent && !uid && !inAuth) {
      router.replace("/auth/sign-in");
      return;
    }
    if (hasConsent && uid && userDoc && !userDoc.currentFamilyId && !inFamilySetup) {
      router.replace("/family/create");
      return;
    }
    if (hasConsent && uid && userDoc?.currentFamilyId && (inOnboarding || inAuth || inFamilySetup)) {
      router.replace("/(tabs)");
    }
  }, [initializing, consentChecked, hasConsent, uid, userDoc, segments, router]);
}
