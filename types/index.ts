export type Language = "en" | "tl";

export interface UserDoc {
  displayName: string;
  email: string;
  photoURL?: string;
  fcmToken?: string;
  settings: {
    language: Language;
    sharingPaused: boolean;
  };
  phone?: string;
  currentFamilyId?: string;
  trialStartedAt?: number;
  activation?: {
    activated: boolean;
    deviceId?: string;
    code?: string;
    activatedAt?: number;
  };
}

export interface ActivationCodeDoc {
  deviceId: string | null;
  boundUid: string | null;
  usedAt: number | null;
  createdAt: number;
  note?: string;
}

export interface FamilyDoc {
  name: string;
  createdBy: string;
  inviteCode: string;
  memberUids: string[];
  createdAt: number;
}

export type MemberRole = "owner" | "member";

export interface FamilyMemberDoc {
  role: MemberRole;
  joinedAt: number;
  consentGiven: boolean;
  consentAt?: number;
}

export interface LiveLocationDoc {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  isMoving: boolean;
  updatedAt: number;
}

export interface PlaceDoc {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdBy: string;
}

export interface LocationHistoryPoint {
  lat: number;
  lng: number;
  updatedAt: number;
}

export type FamilyEventType = "geofence_enter" | "geofence_exit" | "sos" | "checkin";

export interface FamilyEventDoc {
  type: FamilyEventType;
  uid: string;
  placeId?: string;
  message?: string;
  createdAt: number;
}
