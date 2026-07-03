import { useEffect, useState } from "react";

import { db } from "./firebase";
import type { LocationHistoryPoint } from "@/types";

export function useLocationHistory(
  familyId: string | undefined,
  memberUid: string | undefined
): LocationHistoryPoint[] {
  const [points, setPoints] = useState<LocationHistoryPoint[]>([]);

  useEffect(() => {
    if (!familyId || !memberUid) {
      setPoints([]);
      return;
    }

    return db
      .collection("families")
      .doc(familyId)
      .collection("locationHistory")
      .doc(memberUid)
      .collection("points")
      .orderBy("updatedAt", "asc")
      .limit(288)
      .onSnapshot(
        (snap) => {
          setPoints(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                lat: data.lat as number,
                lng: data.lng as number,
                updatedAt: data.updatedAt as number,
              };
            })
          );
        },
        () => setPoints([])
      );
  }, [familyId, memberUid]);

  return points;
}
