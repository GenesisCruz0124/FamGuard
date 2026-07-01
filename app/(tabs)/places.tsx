import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { addPlace } from "@/lib/places";
import { usePlaces } from "@/lib/useFamilyData";

export default function PlacesScreen() {
  const { userDoc, uid } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const places = usePlaces(familyId);

  const [name, setName] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [submitting, setSubmitting] = useState(false);

  async function handleAddPlace() {
    if (!familyId || !uid || !name.trim()) return;
    setSubmitting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location permission required to add a place");
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      await addPlace(familyId, {
        name: name.trim(),
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        radiusMeters: Number(radiusMeters) || 150,
        createdBy: uid,
      });
      setName("");
      setRadiusMeters("150");
    } catch (err) {
      Alert.alert("Couldn't add place", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.title}>{t("places.title")}</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{t("places.noPlaces")}</Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.placeCard}>
            <View style={styles.placeRow}>
              <View style={styles.placeIcon}>
                <Ionicons name="location" size={18} color={colors.primary} />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{item.data.name}</Text>
                <Text style={styles.placeMeta}>{item.data.radiusMeters}m radius</Text>
              </View>
            </View>
          </Card>
        )}
      />

      <Card style={styles.form}>
        <Text style={styles.formTitle}>{t("places.addPlace")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("places.placeName")}
          placeholderTextColor={colors.disabled}
        />
        <TextInput
          style={styles.input}
          value={radiusMeters}
          onChangeText={setRadiusMeters}
          placeholder={t("places.radius")}
          placeholderTextColor={colors.disabled}
          keyboardType="numeric"
        />
        <Button
          label={t("places.save")}
          onPress={handleAddPlace}
          disabled={submitting || !name.trim()}
          loading={submitting}
          icon="add-circle-outline"
        />
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.sm },
  empty: { ...typography.caption, textAlign: "center", paddingVertical: spacing.xl },
  placeCard: { padding: spacing.sm },
  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeInfo: { flex: 1 },
  placeName: { ...typography.body, fontWeight: "600" },
  placeMeta: { ...typography.caption, marginTop: 2 },
  form: { margin: spacing.lg, gap: spacing.md },
  formTitle: { ...typography.sectionLabel },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
