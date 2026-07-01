import Ionicons from "@expo/vector-icons/Ionicons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { isGatedFeatureBlocked, trialDaysRemaining } from "@/lib/activation";
import { useLocationHistory } from "@/lib/useLocationHistory";
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

const TRAIL_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

function memberColor(uid: string, allUids: string[]): string {
  const idx = allUids.indexOf(uid);
  return TRAIL_COLORS[(idx >= 0 ? idx : 0) % TRAIL_COLORS.length];
}

// Devices that are physically close (e.g. two phones on the same desk) can
// land on the same screen pixel at low zoom, hiding every pin but the
// topmost one. Spreads coincident/near-coincident points into a small ring
// so each member's marker stays visible regardless of zoom level.
const COINCIDENT_THRESHOLD_DEGREES = 0.0005; // ~50m
const MARKER_SPREAD_DEGREES = 0.0008; // ~90m

function spreadCoincidentMarkers<T extends { location: { lat: number; lng: number } | null }>(
  members: T[]
): (T & { markerLat: number; markerLng: number })[] {
  const groups: T[][] = [];
  for (const member of members) {
    if (!member.location) continue;
    const group = groups.find((g) => {
      const ref = g[0].location!;
      return (
        Math.abs(ref.lat - member.location!.lat) < COINCIDENT_THRESHOLD_DEGREES &&
        Math.abs(ref.lng - member.location!.lng) < COINCIDENT_THRESHOLD_DEGREES
      );
    });
    if (group) group.push(member);
    else groups.push([member]);
  }

  return groups.flatMap((group) =>
    group.map((member, index) => {
      const { lat, lng } = member.location!;
      if (group.length === 1) return { ...member, markerLat: lat, markerLng: lng };
      const angle = (2 * Math.PI * index) / group.length;
      return {
        ...member,
        markerLat: lat + MARKER_SPREAD_DEGREES * Math.sin(angle),
        markerLng: lng + MARKER_SPREAD_DEGREES * Math.cos(angle),
      };
    })
  );
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid, userDoc } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const members = useLiveMembers(familyId);
  const sharingPaused = userDoc?.settings.sharingPaused ?? false;
  const activationBlocked = isGatedFeatureBlocked(userDoc);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const trailPoints = useLocationHistory(familyId, selectedUid ?? undefined);

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
    if (activationBlocked) return;
    (async () => {
      const fg = await requestForegroundPermission();
      if (!fg) {
        Alert.alert(t("location.foregroundDenied"));
        return;
      }
      const bg = await requestBackgroundPermission();
      if (!bg) {
        Alert.alert(t("location.backgroundDenied"));
        return;
      }
      try {
        await startBackgroundLocationUpdates();
      } catch (err) {
        Alert.alert(t("location.startFailed"), err instanceof Error ? err.message : String(err));
      }
    })();
  }, [uid, familyId, activationBlocked]);

  async function togglePause() {
    if (!uid) return;
    await db.collection("users").doc(uid).update({ "settings.sharingPaused": !sharingPaused });
  }

  async function handleSos() {
    if (!uid || !familyId) return;
    if (activationBlocked) {
      Alert.alert(t("activation.blockedTitle"), t("activation.blockedBody"));
      return;
    }
    await recordFamilyEvent(familyId, { type: "sos", uid });
    Alert.alert(t("sos.sent"));
  }

  async function handleCheckIn() {
    if (!uid || !familyId) return;
    if (activationBlocked) {
      Alert.alert(t("activation.blockedTitle"), t("activation.blockedBody"));
      return;
    }
    await recordFamilyEvent(familyId, { type: "checkin", uid });
    Alert.alert(t("sos.checkInSent"));
  }

  const membersWithLocation = members.filter((m) => m.member.consentGiven && m.location);
  const markersToRender = spreadCoincidentMarkers(membersWithLocation);

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
        {trailPoints.length >= 2 && selectedUid && (
          <MapLibreGL.ShapeSource
            id="trail"
            shape={{
              type: "Feature",
              geometry: { type: "LineString", coordinates: trailPoints.map((p) => [p.lng, p.lat]) },
              properties: {},
            }}
          >
            <MapLibreGL.LineLayer
              id="trailLine"
              style={{ lineColor: memberColor(selectedUid, markersToRender.map((m) => m.uid)), lineWidth: 3, lineOpacity: 0.8 }}
            />
          </MapLibreGL.ShapeSource>
        )}
        {markersToRender.map((m) => (
          <MapLibreGL.PointAnnotation
            key={m.uid}
            id={m.uid}
            coordinate={[m.markerLng, m.markerLat]}
            onSelected={() => { setSelectedUid(m.uid); router.push(`/member/${m.uid}`); }}
          >
            <View style={styles.marker}>
              <Text style={styles.markerText}>{(m.user?.displayName ?? "?")[0]}</Text>
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      <View style={[styles.banner, { top: insets.top + 16 }]}>
        <Ionicons
          name={sharingPaused ? "eye-off-outline" : "eye-outline"}
          size={16}
          color={colors.text}
        />
        <Text style={styles.bannerText}>
          {sharingPaused ? t("map.resumeSharing") : t("map.sharingBanner")}
        </Text>
        <Pressable onPress={togglePause} style={styles.bannerButton}>
          <Text style={styles.bannerButtonText}>
            {sharingPaused ? t("map.resumeSharing") : t("map.pauseSharing")}
          </Text>
        </Pressable>
      </View>

      {activationBlocked ? (
        <View style={[styles.banner, styles.trialBannerBlocked, { top: insets.top + 72 }]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.bannerText, styles.trialBannerTextBlocked]}>{t("activation.trialExpiredBanner")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>{t("activation.enterCode")}</Text>
          </Pressable>
        </View>
      ) : (
        !userDoc?.activation?.activated &&
        trialDaysRemaining(userDoc?.trialStartedAt) <= 3 && (
          <View style={[styles.banner, styles.trialBannerWarning, { top: insets.top + 72 }]}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              {t("activation.trialDaysLeft", { days: trialDaysRemaining(userDoc?.trialStartedAt) })}
            </Text>
          </View>
        )
      )}

      <View style={styles.actions}>
        <Pressable style={styles.sosButton} onPress={handleSos}>
          <Ionicons name="warning" size={22} color="#fff" />
          <Text style={styles.sosButtonText}>{t("sos.button")}</Text>
        </Pressable>
        <Pressable style={styles.checkInButton} onPress={handleCheckIn}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.checkInButtonText}>{t("sos.imSafe")}</Text>
        </Pressable>
      </View>

      <View style={styles.memberList}>
        <View style={styles.memberListHandle} />
        {membersWithLocation.length === 0 ? (
          <Text style={styles.emptyState}>{t("map.noMembersSharing")}</Text>
        ) : (
          membersWithLocation.map((m) => (
            <Pressable key={m.uid} style={styles.memberRow} onPress={() => router.push(`/member/${m.uid}`)}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{(m.user?.displayName ?? "?")[0]}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.user?.displayName ?? "Member"}</Text>
                <Text style={styles.memberMeta}>
                  {t("map.battery", { level: m.location?.batteryLevel ?? "?" })} ·{" "}
                  {t("map.lastSeen", { time: timeAgo(m.location!.updatedAt) })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        )}
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
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerText: { color: "#fff", fontWeight: "700" },
  banner: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow,
  },
  bannerText: { fontSize: 13, fontWeight: "600", flex: 1, color: colors.text },
  bannerButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm + 2 },
  bannerButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  trialBannerBlocked: { backgroundColor: colors.dangerSoft },
  trialBannerTextBlocked: { color: colors.danger },
  trialBannerWarning: { backgroundColor: colors.warningSoft },
  actions: { position: "absolute", bottom: 150, right: spacing.lg, gap: spacing.md },
  sosButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow,
  },
  sosButtonText: { color: "#fff", fontWeight: "700" },
  checkInButton: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow,
  },
  checkInButtonText: { color: "#fff", fontWeight: "700" },
  memberList: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: 220,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow,
  },
  memberListHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  emptyState: { ...typography.caption, textAlign: "center", paddingVertical: spacing.md },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2 },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { color: colors.primary, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { fontWeight: "600", color: colors.text },
  memberMeta: { ...typography.caption, marginTop: 2 },
});
