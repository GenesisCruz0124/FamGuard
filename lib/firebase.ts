// @react-native-firebase/* picks up native config from google-services.json /
// GoogleService-Info.plist automatically — no JS initializeApp call needed.
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";

export const firebaseAuth = auth();
export const db = firestore();
export const fcm = messaging();
