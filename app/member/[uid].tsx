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
  if (s < 900) return "online";
  if (s < 7200) return "away";
  return "offline";
}
const STATUS_COLOR: Record<OnlineStatus, string> = { online: "#16a34a", away: "#d97706", offline: "#94a3b8" };
const STATUS_LABEL: Record<OnlineStatus, string> = { online: "Online", away: "Away", offline: "Offline" };

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

function TrailRow({
  point,
  prev,
  onPress,
}: {
  point: LocationHistoryPoint;
  prev?: LocationHistoryPoint;
  onPress: () => void;
}) {
  const time = new Date(point.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(point.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
  const dist = prev ? distanceMeters(prev, point) : null;
  return (
    <Pressable style={({ pressed }) => [styles.trailRow, pressed && { backgroundColor: colors.primarySoft }]} onPress={onPress}>
      <View style={styles.trailDot} />
      <View style={styles.trailInfo}>
        <Text style={styles.trailTime}>{date} · {time}</Text>
        {dist !== null && dist > 2 && (
          <View style={styles.trailDistRow}>
            <Ionicons name="navigate-outline" size={11} color={colors.primary} />
            <Text style={styles.trailDist}>moved {formatDist(dist)}</Text>
          </View>
        )}
        {(dist === null || dist <= 2) && (
          <Text style={styles.trailStay}>Stationary</Text>
        )}
      </View>
      <Ionicons name="map-outline" size={14} color={colors.disabled} />
    </Pressable>
  );
}

export default function MemberDetailScreen() {
  const { uid: memberUid } = useLocalSearchParams<{ uid: string }>();
  const { userDoc, uid: myUid } = useAuth();
  const members = useLiveMembers(userDoc?.currentFamilyId);
  const member = members.find((m) => m.uid === memberUid);
  const trailPoints = useLocationHistory(userDoc?.currentFamilyId, memberUid);
  const trailNewestFirst = [...trailPoints].reverse();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [focusPoint, setFocusPoint] = useState<LocationHistoryPoint | null>(null);

  const trailGeoJSON = trailPoints.length >= 2
    ? {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: trailPoints.map((p) => [p.lng, p.lat]) },
        properties: {},
      }
    : null;

  const latestPoint = trailPoints[trailPoints.length - 1];
  // The point the full-screen camera should center on
  const mapCenter = focusPoint ?? latestPoint;

  const roomName = ["FamGuard", ...[myUid ?? "", memberUid ?? ""].sort()].join("-");

  async function startCall(video: boolean) {
    const base = `https://meet.jit.si/${roomName}`;
    const url = video ? base : `${base}#config.startWithVideoMuted=true`;
    await WebBrowser.openBrowserAsync(url);
  }

  function openMapAt(point: LocationHistoryPoint) {
    setFocusPoint(point);
    setMapExpanded(true);
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
        {memberUid !== myUid && (
          <Pressable style={[styles.callBtn, styles.callBtnAudio]} onPress={() => startCall(false)}>
            <Ionicons name="call" size={20} color="#fff" />
          </Pressable>
        )}
        {memberUid !== myUid && (
          <Pressable style={[styles.callBtn, styles.callBtnVideo]} onPress={() => startCall(true)}>
            <Ionicons name="videocam" size={20} color="#fff" />
          </Pressable>
        )}
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
            {/* Expand button — opens full map centered on latest point */}
            <Pressable style={styles.expandBtn} onPress={() => openMapAt(latestPoint)}>
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
                  zoomLevel={16}
                  centerCoordinate={mapCenter ? [mapCenter.lng, mapCenter.lat] : [latestPoint.lng, latestPoint.lat]}
                  animationDuration={400}
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
                {/* Highlight the focused trail point */}
                {focusPoint && focusPoint !== latestPoint && (
                  <MapLibreGL.PointAnnotation id="focusPt" coordinate={[focusPoint.lng, focusPoint.lat]}>
                    <View style={styles.dotFocus} />
                  </MapLibreGL.PointAnnotation>
                )}
              </MapLibreGL.MapView>
              {/* Close button */}
              <Pressable style={styles.closeBtn} onPress={() => setMapExpanded(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              {/* Info label */}
              <View style={styles.fullMapLabel}>
                <Text style={styles.fullMapLabelText}>
                  {focusPoint
                    ? new Date(focusPoint.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : `${member.user?.displayName ?? "Member"} · current`}
                </Text>
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
              prev={trailNewestFirst[index + 1]}
              onPress={() => openMapAt(item)}
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
  dotFocus: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#f59e0b", borderWidth: 2, borderColor: "#fff" },
  sectionTitle: { ...typography.body, fontWeight: "600", paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  trailCount: { ...typography.caption },
  empty: { ...typography.caption, textAlign: "center", padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  trailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  trailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  trailInfo: { flex: 1 },
  trailTime: { fontSize: 13, fontWeight: "600", color: colors.text },
  trailDistRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  trailDist: { fontSize: 12, color: colors.primary },
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
