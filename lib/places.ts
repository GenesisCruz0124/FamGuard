import { db } from "./firebase";
import { recordFamilyEvent } from "./notifications";
import type { PlaceDoc } from "@/types";

export async function addPlace(familyId: string, place: PlaceDoc) {
  await db.collection("families").doc(familyId).collection("places").add(place);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Tracks which places the device was last known to be inside, so transitions
// only fire once per enter/exit rather than on every location update.
const insidePlaceIds = new Set<string>();

export async function checkGeofences(
  familyId: string,
  uid: string,
  lat: number,
  lng: number,
  places: { id: string; data: PlaceDoc }[]
) {
  for (const place of places) {
    const distance = haversineMeters(lat, lng, place.data.lat, place.data.lng);
    const isInside = distance <= place.data.radiusMeters;
    const wasInside = insidePlaceIds.has(place.id);

    if (isInside && !wasInside) {
      insidePlaceIds.add(place.id);
      await recordFamilyEvent(familyId, { type: "geofence_enter", uid, placeId: place.id });
    } else if (!isInside && wasInside) {
      insidePlaceIds.delete(place.id);
      await recordFamilyEvent(familyId, { type: "geofence_exit", uid, placeId: place.id });
    }
  }
}
