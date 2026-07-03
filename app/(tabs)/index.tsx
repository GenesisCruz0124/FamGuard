import Ionicons from "@expo/vector-icons/Ionicons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { isGatedFeatureBlocked, trialDaysRemaining } from "@/lib/activation";
import { useLocationHistory } from "@/lib/useLocationHistory";
import { useAuth } from "@/lib/auth";
import * as Location from "expo-location";
import {
  requestBackgroundPermission,
  requestForegroundPermission,
  startBackgroundLocationUpdates,
} from "@/lib/location";
import { recordFamilyEvent } from "@/lib/notifications";
import { setCurrentFamilyId, setCurrentUid, setSharingPaused as persistSharingPaused } from "@/lib/session";
import { useLiveMembers } from "@/lib/useFamilyData";
import { useFamilyEvents } from "@/lib/useFamilyEvents";
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

type OnlineStatus = "online" | "away" | "offline";

function getOnlineStatus(updatedAt: number | undefined): OnlineStatus {
  if (!updatedAt) return "offline";
  const seconds = (Date.now() - updatedAt) / 1000;
  if (seconds < 900) return "online";   // within 15 min
  if (seconds < 7200) return "away";   // within 2 hours
  return "offline";
}

const STATUS_COLOR: Record<OnlineStatus, string> = {
  online: "#16a34a",
  away: "#d97706",
  offline: "#94a3b8",
};

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

function formatAlertTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function initials(displayName: string): string {
  return displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
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
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(() => Date.now());
  const [cameraCenter, setCameraCenter] = useState<[number, number] | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [selectedTrailPoint, setSelectedTrailPoint] = useState<{ lat: number; lng: number; updatedAt: number } | null>(null);
  const trailPoints = useLocationHistory(familyId, selectedUid ?? undefined, userDoc?.settings?.trailHours ?? 8);
  const allEvents = useFamilyEvents(familyId);
  const alertEvents = allEvents.filter((e) => e.type === "sos" || e.type === "checkin");
  const incomingCall = allEvents.find((e) => e.type === "call" && e.targetUid === uid && Date.now() - e.createdAt < 60000);
  const unreadCount = alertEvents.filter((e) => e.createdAt > lastSeenAt).length;

  useEffect(() => {
    setCurrentUid(uid ?? null);
  }, [uid]);

  useEffect(() => {
    if (!incomingCall) return;
    const caller = members.find((m) => m.uid === incomingCall.uid);
    const callerName = caller?.user?.displayName ?? "A family member";
    Alert.alert(
      `📞 Incoming call`,
      `${callerName} is calling you`,
      [
        { text: "Ignore", style: "cancel" },
        {
          text: "Join Video Call",
          onPress: () => {
            const url = `https://meet.jit.si/${incomingCall.roomName}`;
            import("expo-web-browser").then(({ default: wb }) => wb.openBrowserAsync(url));
          },
        },
      ]
    );
  }, [incomingCall?.roomName]);

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
    const phones = members
      .filter((m) => m.uid !== uid && m.user?.phone)
      .map((m) => m.user!.phone!);
    if (phones.length > 0) {
      const myName = userDoc?.displayName ?? "A family member";
      const body = encodeURIComponent(`🆘 SOS! ${myName} needs help! Open FamGuard to see their location.`);
      await Linking.openURL(`sms:${phones.join(",")}?body=${body}`);
    }
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
  // All members shown in list; only those actively sharing shown on map
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    Location.watchHeadingAsync((h) => {
      setCompassHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
    }).then((s) => { sub = s; });
    return () => { sub?.remove(); };
  }, []);

  const allMembers = members.filter((m) => m.user?.displayName);

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView style={styles.map} mapStyle={MAP_STYLE_URL}>
        <MapLibreGL.Camera
          zoomLevel={15}
          centerCoordinate={
            cameraCenter ??
            (() => {
              const mine = membersWithLocation.find((m) => m.uid === uid);
              const loc = mine?.location ?? membersWithLocation[0]?.location;
              return loc ? [loc.lng, loc.lat] : [121.0, 14.6];
            })()
          }
          animationDuration={600}
          heading={compassHeading}
        />
        {selectedUid && (() => {
          const color = memberColor(selectedUid, markersToRender.map((m) => m.uid));
          const memberName = members.find((m) => m.uid === selectedUid)?.user?.displayName ?? "";
          const abbr = initials(memberName);
          return trailPoints.map((p, i) => {
            const isLatest = i === trailPoints.length - 1;
            return (
              <MapLibreGL.PointAnnotation
                key={`trail-${i}`}
                id={`trail-${selectedUid}-${i}`}
                coordinate={[p.lng, p.lat]}
                onSelected={() => { setCameraCenter([p.lng, p.lat]); setSelectedTrailPoint(p); }}
              >
                <View style={styles.trailPinWrap}>
                  <View style={[styles.trailPinHead, { backgroundColor: color }, isLatest && styles.trailPinHeadLatest, !isLatest && { opacity: 0.65 }]}>
                    <Text style={[styles.trailPinText, isLatest && styles.trailPinTextLatest]}>{abbr}</Text>
                  </View>
                  <View style={[styles.trailPinTail, { backgroundColor: color }, !isLatest && { opacity: 0.65 }]} />
                </View>
              </MapLibreGL.PointAnnotation>
            );
          });
        })()}
        {markersToRender.map((m) => {
          const color = memberColor(m.uid, markersToRender.map((x) => x.uid));
          const heading = m.location?.heading ?? null;
          const isMoving = m.location?.isMoving ?? false;
          const rotation = (heading !== null && heading >= 0) ? heading : 0;
          const showArrow = isMoving && heading !== null && heading >= 0;
          return (
            <MapLibreGL.PointAnnotation
              key={m.uid}
              id={m.uid}
              coordinate={[m.markerLng, m.markerLat]}
              onSelected={() => { setSelectedUid(m.uid); router.push(`/member/${m.uid}`); }}
            >
              <View style={styles.markerWrap}>
                {showArrow && (
                  <View style={[styles.arrowHead, { borderBottomColor: color, transform: [{ rotate: `${rotation}deg` }] }]} />
                )}
                <View style={[styles.marker, { backgroundColor: color }, showArrow && styles.markerSmall]}>
                  <Text style={styles.markerText}>{initials(m.user?.displayName ?? "?")}</Text>
                </View>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>

      {/* Bell notification button */}
      <Pressable
        style={[styles.bellBtn, { top: insets.top + 16 }]}
        onPress={() => { setLastSeenAt(Date.now()); setShowNotifs(true); }}
      >
        <Ionicons name={unreadCount > 0 ? "notifications" : "notifications-outline"} size={22} color={colors.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
          </View>
        )}
      </Pressable>

      {/* Notifications modal */}
      <Modal visible={showNotifs} animationType="slide" transparent onRequestClose={() => setShowNotifs(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifs(false)} />
        <View style={[styles.notifsSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.notifsHeader}>
            <Text style={styles.notifsTitle}>{t("notifications.title")}</Text>
            <Pressable onPress={() => setShowNotifs(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {alertEvents.length === 0 ? (
            <Text style={styles.notifsEmpty}>{t("notifications.empty")}</Text>
          ) : (
            <FlatList
              data={alertEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const sender = members.find((m) => m.uid === item.uid);
                const name = sender?.user?.displayName ?? "Member";
                const isSos = item.type === "sos";
                const memberLoc = sender?.location;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.notifRow, pressed && { backgroundColor: colors.primarySoft }]}
                    onPress={() => {
                      setShowNotifs(false);
                      setSelectedUid(item.uid);
                      if (memberLoc) setCameraCenter([memberLoc.lng, memberLoc.lat]);
                    }}
                  >
                    <View style={[styles.notifAvatar, isSos ? styles.notifAvatarSos : styles.notifAvatarSafe]}>
                      <Text style={styles.notifAvatarText}>{name[0]}</Text>
                    </View>
                    <View style={styles.notifInfo}>
                      <Text style={styles.notifName}>{name}</Text>
                      <Text style={[styles.notifLabel, isSos ? styles.notifLabelSos : styles.notifLabelSafe]}>
                        {isSos ? t("notifications.sos") : t("notifications.checkIn")}
                      </Text>
                    </View>
                    <Ionicons name="location" size={14} color={memberLoc ? colors.primary : colors.disabled} style={{ marginRight: 2 }} />
                    <Text style={styles.notifTime}>{formatAlertTime(item.createdAt)}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {activationBlocked ? (
        <View style={[styles.banner, styles.trialBannerBlocked, { top: insets.top + 16 }]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.bannerText, styles.trialBannerTextBlocked]}>{t("activation.trialExpiredBanner")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/settings")} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>{t("activation.enterCode")}</Text>
          </Pressable>
        </View>
      ) : (
        !userDoc?.activation?.activated &&
        trialDaysRemaining(userDoc?.trialStartedAt) <= 3 && (
          <View style={[styles.banner, styles.trialBannerWarning, { top: insets.top + 16 }]}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              {t("activation.trialDaysLeft", { days: trialDaysRemaining(userDoc?.trialStartedAt) })}
            </Text>
          </View>
        )
      )}

      {selectedTrailPoint && (
        <Pressable
          style={[styles.trailPointPanel, { bottom: 180 + insets.bottom }]}
          onPress={() => setSelectedTrailPoint(null)}
        >
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text style={styles.trailPointTime}>{formatAlertTime(selectedTrailPoint.updatedAt)}</Text>
          <Ionicons name="close-circle" size={16} color={colors.disabled} />
        </Pressable>
      )}

      <View style={[styles.memberList, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable style={styles.memberListHandleRow} onPress={() => setPanelCollapsed((v) => !v)}>
          <View style={styles.memberListHandle} />
          <Ionicons
            name={panelCollapsed ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.disabled}
            style={styles.handleChevron}
          />
        </Pressable>
        <View style={styles.actionsRow}>
          <Pressable style={styles.sosButton} onPress={handleSos}>
            <Ionicons name="warning" size={20} color="#fff" />
            <Text style={styles.sosButtonText}>{t("sos.button")}</Text>
          </Pressable>
          <Pressable style={styles.checkInButton} onPress={handleCheckIn}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.checkInButtonText}>{t("sos.imSafe")}</Text>
          </Pressable>
        </View>
        {!panelCollapsed && <ScrollView showsVerticalScrollIndicator={false} style={styles.memberScroll}>
          {allMembers.length === 0 ? (
            <Text style={styles.emptyState}>{t("map.noMembersSharing")}</Text>
          ) : (
            allMembers.map((m) => {
              const isSharing = m.member.consentGiven && m.location;
              return (
                <Pressable key={m.uid} style={styles.memberRow} onPress={() => router.push(`/member/${m.uid}`)}>
                  <View style={styles.avatarWrap}>
                    <View style={[styles.memberAvatar, !isSharing && styles.memberAvatarMuted]}>
                      <Text style={styles.memberAvatarText}>{(m.user?.displayName ?? "?")[0]}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[getOnlineStatus(m.location?.updatedAt)] }]} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.user?.displayName ?? "Member"}</Text>
                    {isSharing ? (
                      <Text style={styles.memberMeta}>
                        {t("map.battery", { level: m.location!.batteryLevel ?? "?" })} ·{" "}
                        {t("map.lastSeen", { time: timeAgo(m.location!.updatedAt) })}
                      </Text>
                    ) : (
                      <Text style={styles.memberMetaMuted}>Not sharing location</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })
          )}
        </ScrollView>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  markerWrap: { alignItems: "center" },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginBottom: -4,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  markerSmall: { width: 30, height: 30, borderRadius: 15 },
  markerText: { color: "#fff", fontWeight: "700", fontSize: 11 },
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
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sosButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow,
  },
  sosButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  checkInButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow,
  },
  checkInButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  memberList: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "50%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow,
  },
  memberScroll: { flexGrow: 0 },
  memberListHandleRow: { alignItems: "center", paddingVertical: spacing.xs },
  memberListHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  handleChevron: { marginTop: 2 },
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
  memberMetaMuted: { ...typography.caption, marginTop: 2, color: colors.disabled, fontStyle: "italic" },
  memberAvatarMuted: { backgroundColor: colors.border },
  avatarWrap: { position: "relative" },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  // Bell button
  bellBtn: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  // Notifications modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  notifsSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: "70%",
    ...shadow,
  },
  notifsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifsTitle: { ...typography.title, fontSize: 18 },
  notifsEmpty: { ...typography.caption, textAlign: "center", paddingVertical: spacing.xl },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  notifAvatarSos: { backgroundColor: colors.dangerSoft },
  notifAvatarSafe: { backgroundColor: colors.successSoft },
  notifAvatarText: { fontWeight: "700", fontSize: 16 },
  notifInfo: { flex: 1 },
  notifName: { fontWeight: "600", color: colors.text, fontSize: 14 },
  notifLabel: { fontSize: 12, marginTop: 2 },
  notifLabelSos: { color: colors.danger, fontWeight: "600" },
  notifLabelSafe: { color: colors.success, fontWeight: "600" },
  notifTime: { ...typography.caption, color: colors.disabled },
  trailPinWrap: { alignItems: "center" },
  trailPinHead: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  trailPinHeadLatest: { width: 30, height: 30, borderRadius: 15 },
  trailPinText: { color: "#fff", fontSize: 7, fontWeight: "700" as const },
  trailPointPanel: {
    position: "absolute", left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    ...require("@/constants/theme").shadow,
  },
  trailPointTime: { flex: 1, fontSize: 13, fontWeight: "600" as const, color: colors.text },
  trailPinTextLatest: { fontSize: 10 },
  trailPinTail: {
    width: 8, height: 8, borderRadius: 1,
    transform: [{ rotate: "45deg" }], marginTop: -4,
  },
});
