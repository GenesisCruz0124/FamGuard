import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { setAppLanguage, t } from "@/i18n";
import { redeemActivationCode, trialDaysRemaining } from "@/lib/activation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { blockMember, leaveFamily, removeMember } from "@/lib/family";
import { useLiveMembers } from "@/lib/useFamilyData";
import { useFamily } from "@/lib/useFamilyData";
import type { Language } from "@/types";

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Row({
  icon,
  label,
  onPress,
  trailing,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.dangerLabel]}>{label}</Text>
      {trailing ?? (onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { uid, userDoc, signOut } = useAuth();
  const family = useFamily(userDoc?.currentFamilyId);
  const [language, setLanguage] = useState<Language>(userDoc?.settings.language ?? "en");
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [phone, setPhone] = useState(userDoc?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const members = useLiveMembers(userDoc?.currentFamilyId);
  const isOwner = family?.createdBy === uid;

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

  async function handleSavePhone() {
    if (!uid) return;
    setSavingPhone(true);
    await db.collection("users").doc(uid).update({ phone: phone.trim() });
    setSavingPhone(false);
    Alert.alert("Saved", "Your phone number has been saved.");
  }

  async function handleTogglePause() {
    if (!uid || !userDoc) return;
    await db.collection("users").doc(uid).update({ "settings.sharingPaused": !userDoc.settings.sharingPaused });
  }

  async function handleRemoveMember(targetUid: string, name: string) {
    const familyId = userDoc?.currentFamilyId;
    if (!familyId) return;
    Alert.alert("Remove member", `Remove ${name} from the family group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeMember(familyId, targetUid);
        },
      },
    ]);
  }

  async function handleBlockMember(targetUid: string, name: string) {
    const familyId = userDoc?.currentFamilyId;
    if (!familyId) return;
    Alert.alert("Block member", `Block ${name}? They will be removed and won't be able to rejoin.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockMember(familyId, targetUid);
        },
      },
    ]);
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

  const isActivated = userDoc?.activation?.activated;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t("settings.title")}</Text>

        <SectionLabel>{t("settings.sectionGeneral")}</SectionLabel>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="language" size={18} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{t("settings.language")}</Text>
            <View style={styles.languageToggle}>
              <Text style={styles.languageOption}>{t("settings.english")}</Text>
              <Switch value={language === "tl"} onValueChange={handleLanguageToggle} trackColor={{ true: colors.primary }} />
              <Text style={styles.languageOption}>{t("settings.taglish")}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </View>
            <TextInput
              style={[styles.rowLabel, styles.phoneInput]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number (+63...)"
              placeholderTextColor={colors.disabled}
              keyboardType="phone-pad"
            />
            <Button
              label={savingPhone ? "..." : "Save"}
              onPress={handleSavePhone}
              disabled={savingPhone || !phone.trim()}
              fullWidth={false}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.rowIcon, userDoc?.settings.sharingPaused ? styles.rowIconDanger : styles.rowIconSuccess]}>
              <Ionicons
                name={userDoc?.settings.sharingPaused ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={userDoc?.settings.sharingPaused ? colors.danger : colors.success}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {userDoc?.settings.sharingPaused ? "Location sharing paused" : "Location is being shared"}
              </Text>
              <Text style={styles.sharingSubtext}>
                {userDoc?.settings.sharingPaused ? "Tap to resume sharing with family" : "Family members can see your location"}
              </Text>
            </View>
            <Pressable style={[styles.sharingToggleBtn, userDoc?.settings.sharingPaused && styles.sharingToggleBtnResume]} onPress={handleTogglePause}>
              <Text style={styles.sharingToggleBtnText}>
                {userDoc?.settings.sharingPaused ? t("settings.resumeSharing") : t("settings.pauseSharing")}
              </Text>
            </Pressable>
          </View>
        </Card>

        {family && (
          <>
            <SectionLabel>{t("settings.sectionFamily")}</SectionLabel>
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="people" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t("family.yourInviteCode")}</Text>
                  <Text style={styles.inviteCode}>{family.inviteCode}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Row icon="exit-outline" label={t("settings.leaveFamily")} onPress={handleLeaveFamily} danger />
            </Card>
          </>
        )}

        {isOwner && members.length > 1 && (
          <>
            <SectionLabel>Members</SectionLabel>
            <Card style={styles.card}>
              {members
                .filter((m) => m.uid !== uid)
                .map((m, i, arr) => {
                  const name = m.user?.displayName ?? "Member";
                  return (
                    <View key={m.uid}>
                      <View style={styles.row}>
                        <View style={styles.rowIcon}>
                          <Ionicons name="person-outline" size={18} color={colors.primary} />
                        </View>
                        <Text style={[styles.rowLabel, { flex: 1 }]}>{name}</Text>
                        <Pressable
                          style={styles.memberActionBtn}
                          onPress={() => handleRemoveMember(m.uid, name)}
                        >
                          <Ionicons name="person-remove-outline" size={16} color={colors.warning} />
                        </Pressable>
                        <Pressable
                          style={[styles.memberActionBtn, styles.memberActionBtnDanger]}
                          onPress={() => handleBlockMember(m.uid, name)}
                        >
                          <Ionicons name="ban-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                      {i < arr.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
            </Card>
          </>
        )}

        <SectionLabel>{t("settings.sectionPlan")}</SectionLabel>
        <Card style={styles.card}>
          {isActivated ? (
            <View style={styles.row}>
              <View style={[styles.rowIcon, styles.rowIconSuccess]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
              <Text style={styles.rowLabel}>{t("activation.activatedLabel")}</Text>
            </View>
          ) : (
            <View style={styles.activationBlock}>
              <View style={styles.trialBadge}>
                <Ionicons name="time-outline" size={14} color={colors.warning} />
                <Text style={styles.trialBadgeText}>
                  {t("activation.trialDaysLeft", { days: trialDaysRemaining(userDoc?.trialStartedAt) })}
                </Text>
              </View>
              <Text style={styles.rowLabel}>{t("activation.enterCodeLabel")}</Text>
              <View style={styles.activationRow}>
                <TextInput
                  style={styles.activationInput}
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder={t("activation.codePlaceholder")}
                  placeholderTextColor={colors.disabled}
                  autoCapitalize="characters"
                />
                <Button
                  label={t("activation.redeemButton")}
                  onPress={handleRedeemCode}
                  disabled={redeeming || !codeInput.trim()}
                  loading={redeeming}
                  fullWidth={false}
                />
              </View>
            </View>
          )}
        </Card>

        <SectionLabel>{t("settings.sectionAccount")}</SectionLabel>
        <Card style={styles.card}>
          <Row icon="log-out-outline" label={t("settings.signOut")} onPress={signOut} />
          <View style={styles.divider} />
          <Row icon="trash-outline" label={t("settings.deleteMyData")} onPress={handleDeleteMyData} danger />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t("settings.footerVersion", {
              version: Constants.expoConfig?.extra?.appVersion
                ?? (Constants as any).manifest?.extra?.appVersion
                ?? (Constants as any).manifest2?.extra?.expoClient?.extra?.appVersion
                ?? "1.2.0",
              build: Constants.expoConfig?.extra?.androidVersionCode
                ?? (Constants as any).manifest?.extra?.androidVersionCode
                ?? "4",
            })}
          </Text>
          <Text style={styles.footerText}>{t("settings.footerDeveloper")}: genesiscruz.dev@gmail.com</Text>
          <Text style={styles.footerText}>
            {t("settings.footerAccount")}: {userDoc?.email ?? "—"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { ...typography.title, marginBottom: spacing.sm },
  sectionLabel: { ...typography.sectionLabel, marginTop: spacing.lg, marginBottom: spacing.xs, marginLeft: spacing.xs },
  card: { padding: spacing.sm, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xs, gap: spacing.md },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: colors.dangerSoft },
  rowIconSuccess: { backgroundColor: colors.successSoft },
  rowLabel: { ...typography.body, flex: 1 },
  dangerLabel: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  languageToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  languageOption: { ...typography.caption },
  inviteCode: { fontSize: 22, fontWeight: "700", letterSpacing: 4, color: colors.text, marginTop: 2 },
  activationBlock: { padding: spacing.xs, gap: spacing.sm },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  trialBadgeText: { fontSize: 12, fontWeight: "600", color: colors.warning },
  activationRow: { flexDirection: "row", gap: spacing.sm },
  activationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  phoneInput: { fontSize: 15, color: colors.text, flex: 1 },
  sharingSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  sharingToggleBtn: {
    backgroundColor: colors.dangerSoft, borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm,
  },
  sharingToggleBtnResume: { backgroundColor: colors.successSoft },
  sharingToggleBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  memberActionBtn: {
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center", marginLeft: 6,
  },
  memberActionBtnDanger: { backgroundColor: colors.dangerSoft },
  footer: { marginTop: spacing.xl, gap: spacing.xs, paddingHorizontal: spacing.xs },
  footerText: { ...typography.caption },
});
