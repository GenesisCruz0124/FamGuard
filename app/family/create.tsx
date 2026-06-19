import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { createFamily } from "@/lib/family";
import { t } from "@/i18n";

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
    <View style={styles.container}>
      <Text style={styles.label}>{t("family.familyName")}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="The Cruz Family" />
      <Pressable style={styles.button} onPress={handleCreate} disabled={submitting || !name.trim()}>
        <Text style={styles.buttonText}>{t("family.create")}</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/family/join")}>
        <Text style={styles.link}>{t("family.joinFamily")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: "center" },
  label: { fontSize: 14, color: "#444" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 14, fontSize: 16 },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#2563eb", textAlign: "center", marginTop: 8, fontSize: 15 },
});
