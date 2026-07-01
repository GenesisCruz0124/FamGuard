import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useLocationHistory } from "@/lib/useLocationHistory";
import { useLiveMembers } from "@/lib/useFamilyData";
import type { LocationHistoryPoint } from "@/types";

function TrailRow({ point }: { point: LocationHistoryPoint }) {
  const time = new Date(point.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = new Date(point.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
  return (
    <View style={styles.trailRow}>
      <Ionicons name="location" size={14} color={colors.primary} style={styles.trailIcon} />
      <View style={styles.trailInfo}>
        <Text style={styles.trailTime}>{date} · {time}</Text>
        <Text style={styles.trailCoords}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Text>
      </View>
    </View>
  );
}

export default function MemberDetailScreen() {
  const { uid: memberUid } = useLocalSearchParams<{ uid: string }>();
  const { userDoc } = useAuth();
  const members = useLiveMembers(userDoc?.currentFamilyId);
  const member = members.find((m) => m.uid === memberUid);
  const trailPoints = useLocationHistory(userDoc?.currentFamilyId, memberUid);
  const trailNewestFirst = [...trailPoints].reverse();

  if (!member) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(member.user?.displayName ?? "?")[0]}</Text>
        </View>
        <View>
          <Text style={styles.title}>{member.user?.displayName ?? "Member"}</Text>
          <Text style={styles.meta}>
            {member.location
              ? `${t("map.battery", { level: member.location.batteryLevel ?? "?" })} · ${member.location.isMoving ? "Moving" : "Stationary"}`
              : "No location yet"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {t("member.recentTrail")}
        {trailNewestFirst.length > 0 && (
          <Text style={styles.trailCount}> ({trailNewestFirst.length})</Text>
        )}
      </Text>

      {trailNewestFirst.length === 0 ? (
        <Text style={styles.empty}>{t("member.noTrailYet")}</Text>
      ) : (
        <FlatList
          data={trailNewestFirst}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <TrailRow point={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 20 },
  title: { ...typography.title, fontSize: 20 },
  meta: { ...typography.caption, marginTop: 2 },
  sectionTitle: { ...typography.body, fontWeight: "600", paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm },
  trailCount: { ...typography.caption },
  empty: { ...typography.caption, textAlign: "center", padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  trailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  trailIcon: { marginTop: 2 },
  trailInfo: { flex: 1 },
  trailTime: { fontSize: 13, fontWeight: "600", color: colors.text },
  trailCoords: { ...typography.caption, marginTop: 2 },
});
