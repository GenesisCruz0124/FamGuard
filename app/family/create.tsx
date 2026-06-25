import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { createFamily } from "@/lib/family";

export default function CreateFamilyScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!uid || !name.trim()) return;
    setSubmitting(true);
    try {
      await createFamily(name.trim(), uid);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Couldn't create family", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="people" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t("family.createFamily")}</Text>
      <Text style={styles.subtitle}>{t("family.familyName")}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="The Cruz Family"
        placeholderTextColor={colors.disabled}
      />
      <Button label={t("family.create")} onPress={handleCreate} disabled={submitting || !name.trim()} loading={submitting} />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("family.or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Button
        label={t("family.joinFamily")}
        onPress={() => router.push("/family/join")}
        variant="secondary"
        icon="key-outline"
      />
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
    fontSize: 16,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption },
});
