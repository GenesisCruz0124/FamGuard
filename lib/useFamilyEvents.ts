import { useEffect, useState } from "react";

import { db } from "./firebase";
import type { FamilyEventDoc } from "@/types";

export function useFamilyEvents(familyId: string | undefined): (FamilyEventDoc & { id: string })[] {
  const [events, setEvents] = useState<(FamilyEventDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!familyId) return;
    return db
      .collection("families")
      .doc(familyId)
      .collection("events")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot((snap) => {
        if (!snap) return;
        setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as FamilyEventDoc) })));
      });
  }, [familyId]);

  return events;
}
