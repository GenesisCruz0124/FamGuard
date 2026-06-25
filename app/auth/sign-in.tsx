import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";

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
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>FamGuard</Text>
        <Text style={styles.subtitle}>{t("auth.tagline")}</Text>
      </View>

      <View style={styles.footer}>
        <Button label={t("auth.signInWithGoogle")} onPress={handleSignIn} loading={signingIn} icon="logo-google" size="lg" />
        <Text style={styles.disclaimer}>{t("auth.privacyNote")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "space-between", padding: spacing.xl },
  brand: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 32 },
  subtitle: { ...typography.subtitle, textAlign: "center", paddingHorizontal: spacing.xl },
  footer: { gap: spacing.md, paddingBottom: spacing.lg },
  disclaimer: { ...typography.caption, textAlign: "center" },
});
