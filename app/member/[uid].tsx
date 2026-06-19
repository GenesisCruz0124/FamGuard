import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useLiveMembers } from "@/lib/useFamilyData";

export default function MemberDetailScreen() {
  const { uid: memberUid } = useLocalSearchParams<{ uid: string }>();
  const { userDoc } = useAuth();
  const members = useLiveMembers(userDoc?.currentFamilyId);
  const member = members.find((m) => m.uid === memberUid);

  if (!member) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{member.user?.displayName ?? "Member"}</Text>
      <Text style={styles.meta}>
        {member.location ? `Battery ${member.location.batteryLevel ?? "?"}%` : "No location yet"}
      </Text>
      <Text style={styles.meta}>
        {member.location?.isMoving ? "Moving" : "Stationary"}
      </Text>
      <Text style={styles.sectionTitle}>{t("member.recentTrail")}</Text>
      <Text style={styles.placeholder}>
        Trail history requires querying a location-history subcollection (not yet written by the
        client) — only the live point is shown for now.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  meta: { fontSize: 14, color: "#444" },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 16 },
  placeholder: { fontSize: 13, color: "#888" },
});
