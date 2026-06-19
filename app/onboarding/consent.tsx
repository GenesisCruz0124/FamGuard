import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { setConsentGiven } from "@/lib/consent";
import { t } from "@/i18n";

export default function ConsentScreen() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);

  async function handleContinue() {
    if (!consented) return;
    await setConsentGiven(true);
    router.replace("/auth/sign-in");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("onboarding.welcomeTitle")}</Text>
      <Text style={styles.body}>{t("onboarding.welcomeBody")}</Text>

      <View style={styles.consentRow}>
        <Switch value={consented} onValueChange={setConsented} />
        <Text style={styles.consentLabel}>{t("onboarding.consentLabel")}</Text>
      </View>

      <Pressable
        style={[styles.button, !consented && styles.buttonDisabled]}
        disabled={!consented}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>{t("onboarding.continue")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 24 },
  title: { fontSize: 28, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22, color: "#444" },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentLabel: { flex: 1, fontSize: 15 },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 16, alignItems: "center" },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
