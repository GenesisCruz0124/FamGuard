import firestore from "@react-native-firebase/firestore";

import { db } from "./firebase";
import type { FamilyDoc, FamilyMemberDoc } from "@/types";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createFamily(name: string, ownerUid: string): Promise<string> {
  const inviteCode = generateInviteCode();
  const familyRef = db.collection("families").doc();

  const family: FamilyDoc = {
    name,
    createdBy: ownerUid,
    inviteCode,
    memberUids: [ownerUid],
    createdAt: Date.now(),
  };
  const member: FamilyMemberDoc = {
    role: "owner",
    joinedAt: Date.now(),
    consentGiven: true,
    consentAt: Date.now(),
  };

  await familyRef.set(family);
  await familyRef.collection("members").doc(ownerUid).set(member);
  await db.collection("users").doc(ownerUid).update({ currentFamilyId: familyRef.id });

  return familyRef.id;
}

export async function joinFamilyByInviteCode(inviteCode: string, uid: string): Promise<string> {
  const snap = await db
    .collection("families")
    .where("inviteCode", "==", inviteCode.toUpperCase())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error("Invalid invite code");
  }

  const familyDoc = snap.docs[0];
  const familyData = familyDoc.data() as import("@/types").FamilyDoc;
  if (familyData.blockedUids?.includes(uid)) {
    throw new Error("You have been removed from this family group.");
  }

  const member: FamilyMemberDoc = {
    role: "member",
    joinedAt: Date.now(),
    consentGiven: true,
    consentAt: Date.now(),
  };

  await familyDoc.ref.update({
    memberUids: firestore.FieldValue.arrayUnion(uid),
  });
  await familyDoc.ref.collection("members").doc(uid).set(member);
  await db.collection("users").doc(uid).update({ currentFamilyId: familyDoc.id });

  return familyDoc.id;
}

export async function leaveFamily(familyId: string, uid: string): Promise<void> {
  const familyRef = db.collection("families").doc(familyId);
  await familyRef.update({
    memberUids: firestore.FieldValue.arrayRemove(uid),
  });
  await familyRef.collection("members").doc(uid).delete();
  await familyRef.collection("locations").doc(uid).delete();
  await db.collection("users").doc(uid).update({ currentFamilyId: firestore.FieldValue.delete() });
}

export async function removeMember(familyId: string, targetUid: string): Promise<void> {
  await leaveFamily(familyId, targetUid);
}

export async function blockMember(familyId: string, targetUid: string): Promise<void> {
  const familyRef = db.collection("families").doc(familyId);
  await familyRef.update({
    memberUids: firestore.FieldValue.arrayRemove(targetUid),
    blockedUids: firestore.FieldValue.arrayUnion(targetUid),
  });
  await familyRef.collection("members").doc(targetUid).delete();
  await familyRef.collection("locations").doc(targetUid).delete();
  await db.collection("users").doc(targetUid).update({ currentFamilyId: firestore.FieldValue.delete() });
}
