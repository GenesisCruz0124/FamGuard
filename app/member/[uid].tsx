import Ionicons from "@expo/vector-icons/Ionicons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useLocationHistory } from "@/lib/useLocationHistory";
import { useLiveMembers } from "@/lib/useFamilyData";
import type { LocationHistoryPoint } from "@/types";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
MapLibreGL.setAccessToken(null);

type OnlineStatus = "online" | "away" | "offline";
function getOnlineStatus(updatedAt: number | undefined): OnlineStatus {
  if (!updatedAt) return "offline";
  const s = (Date.now() - updatedAt) / 1000;
  if (s < 300) return "online";
  if (s < 3600) return "away";
  return "offline";
}
const STATUS_COLOR: Record<OnlineStatus, string> = { online: "#16a34a", away: "#d97706", offline: "#94a3b8" };
const STATUS_LABEL: Record<OnlineStatus, string> = { online: "Online", away: "Away", offline: "Offline" };

// Haversine distance in meters between two lat/lng points
function distanceMeters(a: LocationHistoryPoint, b: LocationHistoryPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function TrailRow({ point, prev }: { point: LocationHistoryPoint; prev?: LocationHistoryPoint }) {
  const time = new Date(point.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(point.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
  const dist = prev ? distanceMeters(prev, point) : null;
  return (
    <View style={styles.trailRow}>
      <View style={styles.trailDot} />
      <View style={styles.trailInfo}>
        <Text style={styles.trailTime}>{date} · {time}</Text>
        {dist !== null && dist > 2 && (
          <Text style={styles.trailDist}>
            <Ionicons name="navigate-outline" size={11} color={colors.primary} /> moved {formatDist(dist)}
          </Text>
        )}
        {(dist === null || dist <= 2) && (
          <Text style={styles.trailStay}>Stationary</Text>
        )}
      </View>
    </View>
  );
}

export default function MemberDetailScreen() {
  const { uid: memberUid } = useLocalSearchParams<{ uid: string }>();
  const { userDoc, uid: myUid } = useAuth();
  const members = useLiveMembers(userDoc?.currentFamilyId);
  const member = members.find((m) => m.uid === memberUid);
  const trailPoints = useLocationHistory(userDoc?.currentFamilyId, memberUid);
  // oldest→newest for the map; newest→oldest for the list
  const trailNewestFirst = [...trailPoints].reverse();
  const [mapExpanded, setMapExpanded] = useState(false);

  const trailGeoJSON = trailPoints.length >= 2
    ? {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: trailPoints.map((p) => [p.lng, p.lat]) },
        properties: {},
      }
    : null;

  // Center map on the most recent point
  const latestPoint = trailPoints[trailPoints.length - 1];

  // Build a deterministic Jitsi room name from the two participants' UIDs
  // so both devices always land in the same room regardless of who taps first.
  const roomName = ["FamGuard", ...[myUid ?? "", memberUid ?? ""].sort()].join("-");

  async function startCall(video: boolean) {
    const base = `https://meet.jit.si/${roomName}`;
    const url = video ? base : `${base}#config.startWithVideoMuted=true`;
    await WebBrowser.openBrowserAsync(url);
  }

  if (!member) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(member.user?.displayName ?? "?")[0]}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[getOnlineStatus(member.location?.updatedAt)] }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{member.user?.displayName ?? "Member"}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[getOnlineStatus(member.location?.updatedAt)] + "22" }]}>
              <View style={[styles.statusPillDot, { backgroundColor: STATUS_COLOR[getOnlineStatus(member.location?.updatedAt)] }]} />
              <Text style={[styles.statusPillText, { color: STATUS_COLOR[getOnlineStatus(member.location?.updatedAt)] }]}>
                {STATUS_LABEL[getOnlineStatus(member.location?.updatedAt)]}
              </Text>
            </View>
            <Text style={styles.meta}>
              {member.location
                ? `${t("map.battery", { level: member.location.batteryLevel ?? "?" })} · ${member.location.isMoving ? "Moving" : "Stationary"}`
                : "Not sharing location"}
            </Text>
          </View>
        </View>
        <Pressable style={[styles.callBtn, styles.callBtnAudio]} onPress={() => startCall(false)}>
          <Ionicons name="call" size={20} color="#fff" />
        </Pressable>
        <Pressable style={[styles.callBtn, styles.callBtnVideo]} onPress={() => startCall(true)}>
          <Ionicons name="videocam" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Mini trail map */}
      {trailPoints.length >= 2 && latestPoint ? (
        <>
          <View style={styles.mapCard}>
            <MapLibreGL.MapView style={styles.map} mapStyle={MAP_STYLE_URL} scrollEnabled={false} zoomEnabled={false}>
              <MapLibreGL.Camera
                zoomLevel={14}
                centerCoordinate={[latestPoint.lng, latestPoint.lat]}
                animationDuration={0}
              />
              <MapLibreGL.ShapeSource id="trail" shape={trailGeoJSON!}>
                <MapLibreGL.LineLayer
                  id="trailLine"
                  style={{ lineColor: colors.primary, lineWidth: 3, lineOpacity: 0.85 }}
                />
              </MapLibreGL.ShapeSource>
              <MapLibreGL.PointAnnotation id="start" coordinate={[trailPoints[0].lng, trailPoints[0].lat]}>
                <View style={styles.dotStart} />
              </MapLibreGL.PointAnnotation>
              <MapLibreGL.PointAnnotation id="end" coordinate={[latestPoint.lng, latestPoint.lat]}>
                <View style={styles.dotEnd} />
              </MapLibreGL.PointAnnotation>
            </MapLibreGL.MapView>
            {/* Expand button overlay */}
            <Pressable style={styles.expandBtn} onPress={() => setMapExpanded(true)}>
              <Ionicons name="expand-outline" size={20} color="#fff" />
            </Pressable>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Current</Text>
              </View>
              <Text style={styles.legendCount}>{trailPoints.length} points · last 24h</Text>
            </View>
          </View>

          {/* Full-screen map modal */}
          <Modal visible={mapExpanded} animationType="slide" statusBarTranslucent onRequestClose={() => setMapExpanded(false)}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <View style={styles.fullMapContainer}>
              <MapLibreGL.MapView style={styles.fullMap} mapStyle={MAP_STYLE_URL}>
                <MapLibreGL.Camera
                  zoomLevel={14}
                  centerCoordinate={[latestPoint.lng, latestPoint.lat]}
                  animationDuration={0}
                />
                <MapLibreGL.ShapeSource id="trailFull" shape={trailGeoJSON!}>
                  <MapLibreGL.LineLayer
                    id="trailLineFull"
                    style={{ lineColor: colors.primary, lineWidth: 4, lineOpacity: 0.9 }}
                  />
                </MapLibreGL.ShapeSource>
                <MapLibreGL.PointAnnotation id="startFull" coordinate={[trailPoints[0].lng, trailPoints[0].lat]}>
                  <View style={styles.dotStart} />
                </MapLibreGL.PointAnnotation>
                <MapLibreGL.PointAnnotation id="endFull" coordinate={[latestPoint.lng, latestPoint.lat]}>
                  <View style={styles.dotEnd} />
                </MapLibreGL.PointAnnotation>
              </MapLibreGL.MapView>
              {/* Close button */}
              <Pressable style={styles.closeBtn} onPress={() => setMapExpanded(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              {/* Name label */}
              <View style={styles.fullMapLabel}>
                <Text style={styles.fullMapLabelText}>{member.user?.displayName ?? "Member"} · trail</Text>
                <Text style={styles.fullMapLabelSub}>{trailPoints.length} points · last 24h · pinch to zoom</Text>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      {/* Trail list */}
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
          renderItem={({ item, index }) => (
            <TrailRow
              point={item}
              // "prev" in newest-first order means the point recorded just before this one
              prev={trailNewestFirst[index + 1]}
            />
          )}
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
  avatarWrap: { position: "relative" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 20 },
  statusDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
  },
  metaRow: { marginTop: 3, gap: spacing.xs },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  title: { ...typography.title, fontSize: 20 },
  meta: { ...typography.caption },
  mapCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow,
    marginBottom: spacing.md,
  },
  map: { height: 180 },
  expandBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  fullMapContainer: { flex: 1, backgroundColor: "#000" },
  fullMap: { flex: 1 },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.pill,
    padding: spacing.sm,
  },
  fullMapLabel: {
    position: "absolute",
    bottom: 40,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fullMapLabelText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fullMapLabelSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  mapLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textMuted },
  legendCount: { fontSize: 11, color: colors.disabled, marginLeft: "auto" },
  dotStart: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textMuted, borderWidth: 2, borderColor: "#fff" },
  dotEnd: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 2, borderColor: "#fff" },
  sectionTitle: { ...typography.body, fontWeight: "600", paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  trailCount: { ...typography.caption },
  empty: { ...typography.caption, textAlign: "center", padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  trailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  trailInfo: { flex: 1 },
  trailTime: { fontSize: 13, fontWeight: "600", color: colors.text },
  trailDist: { fontSize: 12, color: colors.primary, marginTop: 2 },
  trailStay: { fontSize: 12, color: colors.disabled, marginTop: 2, fontStyle: "italic" },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  callBtnAudio: { backgroundColor: colors.success },
  callBtnVideo: { backgroundColor: colors.primary },
});
