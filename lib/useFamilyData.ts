import { useEffect, useState } from "react";

import { db } from "./firebase";
import type { FamilyDoc, FamilyMemberDoc, LiveLocationDoc, PlaceDoc, UserDoc } from "@/types";

export interface LiveMember {
  uid: string;
  user: UserDoc | null;
  member: FamilyMemberDoc;
  location: LiveLocationDoc | null;
}

export function useFamily(familyId: string | undefined) {
  const [family, setFamily] = useState<FamilyDoc | null>(null);

  useEffect(() => {
    if (!familyId) return;
    return db.collection("families").doc(familyId).onSnapshot((snap) => {
      setFamily((snap.data() as FamilyDoc) ?? null);
    });
  }, [familyId]);

  return family;
}

export function useLiveMembers(familyId: string | undefined) {
  const [members, setMembers] = useState<LiveMember[]>([]);

  useEffect(() => {
    if (!familyId) return;

    const familyRef = db.collection("families").doc(familyId);
    const unsubscribers: (() => void)[] = [];

    const unsubMembers = familyRef.collection("members").onSnapshot(async (membersSnap) => {
      unsubscribers.forEach((unsub) => unsub());
      unsubscribers.length = 0;

      const next: LiveMember[] = membersSnap.docs.map((doc) => ({
        uid: doc.id,
        user: null,
        member: doc.data() as FamilyMemberDoc,
        location: null,
      }));
      setMembers(next);

      membersSnap.docs.forEach((doc) => {
        const uid = doc.id;
        const unsubUser = db.collection("users").doc(uid).onSnapshot((userSnap) => {
          setMembers((prev) =>
            prev.map((m) => (m.uid === uid ? { ...m, user: (userSnap.data() as UserDoc) ?? null } : m))
          );
        });
        const unsubLoc = familyRef.collection("locations").doc(uid).onSnapshot((locSnap) => {
          setMembers((prev) =>
            prev.map((m) => (m.uid === uid ? { ...m, location: (locSnap.data() as LiveLocationDoc) ?? null } : m))
          );
        });
        unsubscribers.push(unsubUser, unsubLoc);
      });
    });

    return () => {
      unsubMembers();
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [familyId]);

  return members;
}

export function usePlaces(familyId: string | undefined) {
  const [places, setPlaces] = useState<{ id: string; data: PlaceDoc }[]>([]);

  useEffect(() => {
    if (!familyId) return;
    return db
      .collection("families")
      .doc(familyId)
      .collection("places")
      .onSnapshot((snap) => {
        setPlaces(snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as PlaceDoc })));
      });
  }, [familyId]);

  return places;
}
