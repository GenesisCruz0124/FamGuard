import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { joinFamilyByInviteCode } from "@/lib/family";

export default function JoinFamilyScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin() {
    if (!uid || !code.trim()) return;
    setSubmitting(true);
    try {
      await joinFamilyByInviteCode(code.trim(), uid);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Couldn't join family", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="key" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t("family.joinFamily")}</Text>
      <Text style={styles.subtitle}>{t("family.inviteCode")}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="ABC123"
        placeholderTextColor={colors.disabled}
        autoCapitalize="characters"
        maxLength={6}
      />
      <Button label={t("family.join")} onPress={handleJoin} disabled={submitting || !code.trim()} loading={submitting} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: "center", gap: spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, textAlign: "center", marginBottom: spacing.lg },
  subtitle: { ...typography.sectionLabel },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
    fontWeight: "700",
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
});
