import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { addPlace } from "@/lib/places";
import { usePlaces } from "@/lib/useFamilyData";
import * as Location from "expo-location";

export default function PlacesScreen() {
  const { userDoc, uid } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const places = usePlaces(familyId);

  const [name, setName] = useState("");
  const [radius, setRadius] = useState("150");
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
        radiusMeters: Number(radius) || 150,
        createdBy: uid,
      });
      setName("");
    } catch (err) {
      Alert.alert("Couldn't add place", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.header}>{t("places.title")}</Text>}
        renderItem={({ item }) => (
          <View style={styles.placeRow}>
            <Text style={styles.placeName}>{item.data.name}</Text>
            <Text style={styles.placeMeta}>{item.data.radiusMeters}m radius</Text>
          </View>
        )}
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("places.placeName")}
        />
        <TextInput
          style={styles.input}
          value={radius}
          onChangeText={setRadius}
          placeholder={t("places.radius")}
          keyboardType="numeric"
        />
        <Pressable style={styles.button} onPress={handleAddPlace} disabled={submitting || !name.trim()}>
          <Text style={styles.buttonText}>{t("places.save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  placeRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  placeName: { fontSize: 16, fontWeight: "600" },
  placeMeta: { fontSize: 12, color: "#666" },
  form: { gap: 10, paddingTop: 16 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12 },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
