import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, View, Text } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppGate } from '@/hooks/useAppGate';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

const MIN_LOADING_MS = 2500;

function LoadingScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.loadingContainer}>
      {/* Top glow blob */}
      <View style={styles.glowTop} />

      <View style={styles.loadingContent}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulse }] }]}>
          <Image source={require('../assets/images/icon.png')} style={styles.loadingLogo} />
        </Animated.View>

        <Text style={styles.loadingTitle}>FamGuard</Text>
        <Text style={styles.loadingTagline}>Keep your family close, wherever they are</Text>

        <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" style={styles.spinner} />
      </View>

      {/* Bottom wave decoration */}
      <View style={styles.glowBottom} />
    </View>
  );
}

function GatedNavigator() {
  const { initializing } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  useAppGate();
  const colorScheme = useColorScheme();

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  if (initializing || !minElapsed) return <LoadingScreen />;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="onboarding/consent" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="family/create" options={{ title: 'Create Family' }} />
        <Stack.Screen name="family/join" options={{ title: 'Join Family' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="member/[uid]" options={{ title: 'Member' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GatedNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const PRIMARY = "#2563eb";
const PRIMARY_DARK = "#1d4ed8";

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glowTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  loadingContent: {
    alignItems: "center",
    gap: 12,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  loadingLogo: {
    width: 90,
    height: 90,
    borderRadius: 20,
  },
  loadingTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  loadingTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  spinner: {
    marginTop: 32,
  },
});
