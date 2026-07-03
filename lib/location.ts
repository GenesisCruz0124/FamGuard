import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { db } from "./firebase";
import type { LiveLocationDoc } from "@/types";

export const LOCATION_TASK_NAME = "famguard-background-location";

// Slower updates while stationary, tighter updates while moving — balances
// live-map freshness against battery drain.
const MOVING_DISTANCE_INTERVAL_METERS = 25;
const MOVING_TIME_INTERVAL_MS = 15_000;
const STATIONARY_TIME_INTERVAL_MS = 60_000;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const location = locations?.[locations.length - 1];
  if (!location) return;

  await writeLiveLocation(location);
});

export async function writeLiveLocation(location: Location.LocationObject) {
  const { getCurrentFamilyId, getCurrentUid, getSharingPaused } = await import("./session");
  const [familyId, uid, sharingPaused] = await Promise.all([
    getCurrentFamilyId(),
    getCurrentUid(),
    getSharingPaused(),
  ]);
  if (!familyId || !uid || sharingPaused) return;

  const batteryLevel = await Battery.getBatteryLevelAsync();
  const batteryState = await Battery.getBatteryStateAsync();

  const doc: LiveLocationDoc = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
    batteryLevel: batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null,
    isCharging: batteryState === Battery.BatteryState.CHARGING,
    isMoving: (location.coords.speed ?? 0) > 0.5,
    updatedAt: Date.now(),
  };

  await db
    .collection("families")
    .doc(familyId)
    .collection("locations")
    .doc(uid)
    .set(doc, { merge: true });

  await appendHistoryPoint(familyId, uid, doc.lat, doc.lng);

  const { checkGeofences } = await import("./places");
  const placesSnap = await db.collection("families").doc(familyId).collection("places").get();
  const places = placesSnap.docs.map((d) => ({ id: d.id, data: d.data() as import("@/types").PlaceDoc }));
  await checkGeofences(familyId, uid, doc.lat, doc.lng, places);
}

const TRAIL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TRAIL_MIN_DISTANCE_METERS = 30;    // skip if moved less than 30 m

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function appendHistoryPoint(familyId: string, uid: string, lat: number, lng: number) {
  const pointsRef = db
    .collection("families")
    .doc(familyId)
    .collection("locationHistory")
    .doc(uid)
    .collection("points");

  // Get the most recent point to check time + distance
  const lastSnap = await pointsRef.orderBy("updatedAt", "desc").limit(1).get();
  if (!lastSnap.empty) {
    const last = lastSnap.docs[0].data();
    const elapsed = Date.now() - (last.updatedAt as number);
    const dist = haversineMeters(last.lat as number, last.lng as number, lat, lng);
    // Skip if not enough time has passed OR location hasn't changed meaningfully
    if (elapsed < TRAIL_INTERVAL_MS || dist < TRAIL_MIN_DISTANCE_METERS) return;
  }

  await pointsRef.add({ lat, lng, updatedAt: Date.now() });

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const stale = await pointsRef.where("updatedAt", "<", cutoff).limit(10).get();
  if (!stale.empty) {
    const batch = db.batch();
    stale.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function requestForegroundPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestBackgroundPermission() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted";
}

export async function startBackgroundLocationUpdates() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: MOVING_DISTANCE_INTERVAL_METERS,
    timeInterval: MOVING_TIME_INTERVAL_MS,
    deferredUpdatesInterval: STATIONARY_TIME_INTERVAL_MS,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "FamGuard",
      notificationBody: "Sharing your location with your family",
    },
  });
}

export async function stopBackgroundLocationUpdates() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
