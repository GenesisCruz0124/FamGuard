import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { t } from "@/i18n";

export default function SignInScreen() {
  const { signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert("Sign-in failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FamGuard</Text>
      <Pressable style={styles.button} onPress={handleSignIn} disabled={signingIn}>
        {signingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t("auth.signInWithGoogle")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 32 },
  title: { fontSize: 32, fontWeight: "700" },
  button: { backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
