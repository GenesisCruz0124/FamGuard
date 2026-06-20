import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setAppLanguage, t } from "@/i18n";
import { redeemActivationCode } from "@/lib/activation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { leaveFamily } from "@/lib/family";
import { useFamily } from "@/lib/useFamilyData";
import type { Language } from "@/types";

export default function SettingsScreen() {
  const router = useRouter();
  const { uid, userDoc, signOut } = useAuth();
  const family = useFamily(userDoc?.currentFamilyId);
  const [language, setLanguage] = useState<Language>(userDoc?.settings.language ?? "en");
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  async function handleRedeemCode() {
    if (!uid || !codeInput.trim()) return;
    setRedeeming(true);
    const result = await redeemActivationCode(codeInput, uid);
    setRedeeming(false);
    if (result.ok) {
      setCodeInput("");
      Alert.alert(t("activation.redeemSuccess"));
    } else if (result.reason === "not_found") {
      Alert.alert(t("activation.redeemNotFound"));
    } else if (result.reason === "bound_to_other_device") {
      Alert.alert(t("activation.redeemBoundElsewhere"));
    } else {
      Alert.alert(t("activation.redeemError"));
    }
  }

  async function handleLanguageToggle() {
    if (!uid) return;
    const next: Language = language === "en" ? "tl" : "en";
    setLanguage(next);
    setAppLanguage(next);
    await db.collection("users").doc(uid).update({ "settings.language": next });
  }

  async function handleTogglePause() {
    if (!uid || !userDoc) return;
    await db.collection("users").doc(uid).update({ "settings.sharingPaused": !userDoc.settings.sharingPaused });
  }

  async function handleLeaveFamily() {
    if (!uid || !userDoc?.currentFamilyId) return;
    Alert.alert("Leave family?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: t("settings.leaveFamily"),
        style: "destructive",
        onPress: async () => {
          await leaveFamily(userDoc.currentFamilyId!, uid);
          router.replace("/family/create");
        },
      },
    ]);
  }

  async function handleDeleteMyData() {
    if (!uid) return;
    Alert.alert("Delete my data?", "This removes your profile and live location permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: t("settings.deleteMyData"),
        style: "destructive",
        onPress: async () => {
          if (userDoc?.currentFamilyId) {
            await leaveFamily(userDoc.currentFamilyId, uid);
          }
          await db.collection("users").doc(uid).delete();
          await signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t("settings.language")}</Text>
        <View style={styles.languageToggle}>
          <Text>{t("settings.english")}</Text>
          <Switch value={language === "tl"} onValueChange={handleLanguageToggle} />
          <Text>{t("settings.taglish")}</Text>
        </View>
      </View>

      {family && (
        <View style={styles.row}>
          <Text style={styles.label}>{t("family.yourInviteCode")}</Text>
          <Text style={styles.inviteCode}>{family.inviteCode}</Text>
        </View>
      )}

      <Pressable style={styles.row} onPress={handleTogglePause}>
        <Text style={styles.label}>
          {userDoc?.settings.sharingPaused ? t("settings.resumeSharing") : t("settings.pauseSharing")}
        </Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleLeaveFamily}>
        <Text style={styles.dangerLabel}>{t("settings.leaveFamily")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleDeleteMyData}>
        <Text style={styles.dangerLabel}>{t("settings.deleteMyData")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={signOut}>
        <Text style={styles.label}>{t("settings.signOut")}</Text>
      </Pressable>

      {userDoc?.activation?.activated ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t("activation.activatedLabel")}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{t("activation.enterCodeLabel")}</Text>
          <View style={styles.activationRow}>
            <TextInput
              style={styles.activationInput}
              value={codeInput}
              onChangeText={setCodeInput}
              placeholder={t("activation.codePlaceholder")}
              autoCapitalize="characters"
            />
            <Pressable style={styles.activationButton} onPress={handleRedeemCode} disabled={redeeming}>
              <Text style={styles.activationButtonText}>
                {redeeming ? "..." : t("activation.redeemButton")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t("settings.footerVersion", {
            version: Constants.expoConfig?.extra?.appVersion ?? "?",
            build: Constants.expoConfig?.extra?.androidVersionCode ?? "?",
          })}
        </Text>
        <Text style={styles.footerText}>{t("settings.footerDeveloper")}: genesiscruz.dev@gmail.com</Text>
        <Text style={styles.footerText}>
          {t("settings.footerAccount")}: {userDoc?.email ?? "—"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  label: { fontSize: 16 },
  dangerLabel: { fontSize: 16, color: "#dc2626" },
  languageToggle: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  inviteCode: { fontSize: 24, fontWeight: "700", letterSpacing: 4, marginTop: 8 },
  activationRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  activationInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  activationButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  activationButtonText: { color: "#fff", fontWeight: "600" },
  footer: { marginTop: "auto", paddingTop: 16, gap: 4 },
  footerText: { fontSize: 12, color: "#666" },
});
