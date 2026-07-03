import * as Notifications from "expo-notifications";

import { db } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerFcmToken(uid: string, token: string) {
  await db.collection("users").doc(uid).update({ fcmToken: token });
}

// Sending pushes to other family members requires a privileged context
// (Cloud Function / server) since clients can't read each other's fcmToken
// under the security rules. This writes the event; a Cloud Function trigger
// on families/{familyId}/events/{eventId} is responsible for the actual push.
export async function recordFamilyEvent(
  familyId: string,
  event: { type: "geofence_enter" | "geofence_exit" | "sos" | "checkin" | "call"; uid: string; targetUid?: string; roomName?: string; placeId?: string; message?: string }
) {
  await db.collection("families").doc(familyId).collection("events").add({
    ...event,
    createdAt: Date.now(),
  });
}
