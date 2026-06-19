import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { db, firebaseAuth } from "./firebase";
import type { UserDoc } from "@/types";

GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.googleSignInWebClientId,
  offlineAccess: false,
});

interface AuthContextValue {
  uid: string | null;
  userDoc: UserDoc | null;
  initializing: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      setUid(user?.uid ?? null);
      setInitializing(false);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!uid) {
      setUserDoc(null);
      return;
    }
    const unsubscribe = db
      .collection("users")
      .doc(uid)
      .onSnapshot((snap) => setUserDoc((snap.data() as UserDoc) ?? null));
    return unsubscribe;
  }, [uid]);

  async function signInWithGoogle() {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== "success" || !response.data.idToken) {
      throw new Error("Google sign-in was cancelled");
    }
    const credential = auth.GoogleAuthProvider.credential(response.data.idToken);
    const result = await firebaseAuth.signInWithCredential(credential);

    const userRef = db.collection("users").doc(result.user.uid);
    const existing = await userRef.get();
    if (!existing.exists) {
      const newUser: UserDoc = {
        displayName: result.user.displayName ?? "",
        email: result.user.email ?? "",
        photoURL: result.user.photoURL ?? undefined,
        settings: { language: "en", sharingPaused: false },
      };
      await userRef.set(newUser);
    }
  }

  async function signOut() {
    await GoogleSignin.signOut();
    await firebaseAuth.signOut();
  }

  return (
    <AuthContext.Provider value={{ uid, userDoc, initializing, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
