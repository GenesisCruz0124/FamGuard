import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { setConsentGiven } from "@/lib/consent";

export default function ConsentScreen() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);

  async function handleContinue() {
    if (!consented) return;
    await setConsentGiven(true);
    router.replace("/auth/sign-in");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="location" size={36} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t("onboarding.welcomeTitle")}</Text>
      <Text style={styles.body}>{t("onboarding.welcomeBody")}</Text>

      <Card style={styles.consentCard}>
        <Pressable style={styles.consentRow} onPress={() => setConsented((v) => !v)}>
          <Switch value={consented} onValueChange={setConsented} trackColor={{ true: colors.primary }} />
          <Text style={styles.consentLabel}>{t("onboarding.consentLabel")}</Text>
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <Button label={t("onboarding.continue")} onPress={handleContinue} disabled={!consented} size="lg" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.lg },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  title: { ...typography.title },
  body: { ...typography.body, lineHeight: 22, color: colors.textMuted },
  consentCard: { marginTop: spacing.sm },
  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  consentLabel: { flex: 1, fontSize: 15, color: colors.text },
  footer: { marginTop: "auto", paddingBottom: spacing.lg },
});
