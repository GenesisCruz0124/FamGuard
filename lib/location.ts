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

  const { checkGeofences } = await import("./places");
  const placesSnap = await db.collection("families").doc(familyId).collection("places").get();
  const places = placesSnap.docs.map((d) => ({ id: d.id, data: d.data() as import("@/types").PlaceDoc }));
  await checkGeofences(familyId, uid, doc.lat, doc.lng, places);
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
