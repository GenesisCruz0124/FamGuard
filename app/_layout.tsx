import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, Text } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppGate } from '@/hooks/useAppGate';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

const MIN_LOADING_MS = 2500;

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Image source={require('../assets/images/icon.png')} style={styles.loadingLogo} />
      <Text style={styles.loadingTitle}>FamGuard</Text>
      <ActivityIndicator size="large" color="#4F8EF7" style={{ marginTop: 32 }} />
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogo: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
    letterSpacing: 0.5,
  },
});
