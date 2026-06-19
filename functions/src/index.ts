import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

interface FamilyEventDoc {
  type: "geofence_enter" | "geofence_exit" | "sos" | "checkin";
  uid: string;
  placeId?: string;
  message?: string;
  createdAt: number;
}

// Clients can only write events, not read each other's fcmToken, so the
// actual push to other family members has to happen in a trusted context.
export const onFamilyEventCreated = onDocumentCreated(
  "families/{familyId}/events/{eventId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { familyId } = event.params;
    const eventData = snap.data() as FamilyEventDoc;

    const [familySnap, actorSnap] = await Promise.all([
      db.collection("families").doc(familyId).get(),
      db.collection("users").doc(eventData.uid).get(),
    ]);
    const family = familySnap.data();
    const actorName = actorSnap.data()?.displayName ?? "A family member";
    if (!family) return;

    const recipientUids: string[] = family.memberUids.filter((uid: string) => uid !== eventData.uid);
    if (recipientUids.length === 0) return;

    const recipientSnaps = await Promise.all(
      recipientUids.map((uid) => db.collection("users").doc(uid).get())
    );
    const tokens = recipientSnaps
      .map((s) => s.data()?.fcmToken as string | undefined)
      .filter((token): token is string => !!token);
    if (tokens.length === 0) return;

    const { title, body } = await buildNotification(eventData, actorName, familyId);

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { type: eventData.type, familyId, uid: eventData.uid },
    });
  }
);

async function buildNotification(
  eventData: FamilyEventDoc,
  actorName: string,
  familyId: string
): Promise<{ title: string; body: string }> {
  switch (eventData.type) {
    case "geofence_enter": {
      const place = eventData.placeId
        ? (await db.collection("families").doc(familyId).collection("places").doc(eventData.placeId).get()).data()
        : undefined;
      return { title: "FamGuard", body: `${actorName} arrived at ${place?.name ?? "a place"}` };
    }
    case "geofence_exit": {
      const place = eventData.placeId
        ? (await db.collection("families").doc(familyId).collection("places").doc(eventData.placeId).get()).data()
        : undefined;
      return { title: "FamGuard", body: `${actorName} left ${place?.name ?? "a place"}` };
    }
    case "sos":
      return { title: "FamGuard SOS", body: `${actorName} triggered an SOS alert!` };
    case "checkin":
      return { title: "FamGuard", body: `${actorName} checked in: I'm safe` };
  }
}
