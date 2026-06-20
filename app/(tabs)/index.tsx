import MapLibreGL from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import {
  requestBackgroundPermission,
  requestForegroundPermission,
  startBackgroundLocationUpdates,
} from "@/lib/location";
import { recordFamilyEvent } from "@/lib/notifications";
import { setCurrentFamilyId, setCurrentUid, setSharingPaused as persistSharingPaused } from "@/lib/session";
import { useLiveMembers } from "@/lib/useFamilyData";
import { db } from "@/lib/firebase";

// OpenFreeMap: free vector tiles, no API key or billing account required.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

MapLibreGL.setAccessToken(null);

function timeAgo(updatedAt: number): string {
  const seconds = Math.floor((Date.now() - updatedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid, userDoc } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const members = useLiveMembers(familyId);
  const sharingPaused = userDoc?.settings.sharingPaused ?? false;

  useEffect(() => {
    setCurrentUid(uid ?? null);
  }, [uid]);

  useEffect(() => {
    setCurrentFamilyId(familyId ?? null);
  }, [familyId]);

  useEffect(() => {
    persistSharingPaused(sharingPaused);
  }, [sharingPaused]);

  useEffect(() => {
    if (!uid || !familyId) return;
    (async () => {
      const fg = await requestForegroundPermission();
      if (!fg) return;
      await requestBackgroundPermission();
      await startBackgroundLocationUpdates();
    })();
  }, [uid, familyId]);

  async function togglePause() {
    if (!uid) return;
    await db.collection("users").doc(uid).update({ "settings.sharingPaused": !sharingPaused });
  }

  async function handleSos() {
    if (!uid || !familyId) return;
    await recordFamilyEvent(familyId, { type: "sos", uid });
    Alert.alert(t("sos.sent"));
  }

  async function handleCheckIn() {
    if (!uid || !familyId) return;
    await recordFamilyEvent(familyId, { type: "checkin", uid });
    Alert.alert(t("sos.checkInSent"));
  }

  const membersWithLocation = members.filter((m) => m.member.consentGiven && m.location);

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView style={styles.map} mapStyle={MAP_STYLE_URL}>
        <MapLibreGL.Camera
          zoomLevel={12}
          centerCoordinate={
            membersWithLocation[0]?.location
              ? [membersWithLocation[0].location.lng, membersWithLocation[0].location.lat]
              : [121.0, 14.6]
          }
        />
        {membersWithLocation.map((m) => (
          <MapLibreGL.PointAnnotation
            key={m.uid}
            id={m.uid}
            coordinate={[m.location!.lng, m.location!.lat]}
            onSelected={() => router.push(`/member/${m.uid}`)}
          >
            <View style={styles.marker}>
              <Text style={styles.markerText}>{(m.user?.displayName ?? "?")[0]}</Text>
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      <View style={[styles.banner, { top: insets.top + 16 }]}>
        <Text style={styles.bannerText}>
          {sharingPaused ? t("map.resumeSharing") : t("map.sharingBanner")}
        </Text>
        <Pressable onPress={togglePause} style={styles.bannerButton}>
          <Text style={styles.bannerButtonText}>
            {sharingPaused ? t("map.resumeSharing") : t("map.pauseSharing")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.sosButton} onPress={handleSos}>
          <Text style={styles.sosButtonText}>{t("sos.button")}</Text>
        </Pressable>
        <Pressable style={styles.checkInButton} onPress={handleCheckIn}>
          <Text style={styles.checkInButtonText}>{t("sos.imSafe")}</Text>
        </Pressable>
      </View>

      <View style={styles.memberList}>
        {membersWithLocation.map((m) => (
          <Pressable key={m.uid} style={styles.memberRow} onPress={() => router.push(`/member/${m.uid}`)}>
            <Text style={styles.memberName}>{m.user?.displayName ?? "Member"}</Text>
            <Text style={styles.memberMeta}>
              {t("map.battery", { level: m.location?.batteryLevel ?? "?" })} ·{" "}
              {t("map.lastSeen", { time: timeAgo(m.location!.updatedAt) })}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerText: { color: "#fff", fontWeight: "700" },
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bannerText: { fontSize: 13, fontWeight: "600", flex: 1 },
  bannerButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  bannerButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  actions: { position: "absolute", bottom: 140, right: 16, gap: 12 },
  sosButton: { backgroundColor: "#dc2626", borderRadius: 999, padding: 16, alignItems: "center" },
  sosButtonText: { color: "#fff", fontWeight: "700" },
  checkInButton: { backgroundColor: "#16a34a", borderRadius: 999, padding: 16, alignItems: "center" },
  checkInButtonText: { color: "#fff", fontWeight: "700" },
  memberList: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 12, maxHeight: 120 },
  memberRow: { paddingVertical: 6 },
  memberName: { fontWeight: "600" },
  memberMeta: { fontSize: 12, color: "#666" },
});
