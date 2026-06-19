import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { joinFamilyByInviteCode } from "@/lib/family";
import { t } from "@/i18n";

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
    <View style={styles.container}>
      <Text style={styles.label}>{t("family.inviteCode")}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        maxLength={6}
      />
      <Pressable style={styles.button} onPress={handleJoin} disabled={submitting || !code.trim()}>
        <Text style={styles.buttonText}>{t("family.join")}</Text>
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
});
