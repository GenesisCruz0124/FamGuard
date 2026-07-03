import Ionicons from "@expo/vector-icons/Ionicons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, FlatList, Linking, Modal, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { addPlace } from "@/lib/places";
import { usePlaces } from "@/lib/useFamilyData";
import type { PlaceDoc } from "@/types";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
MapLibreGL.setAccessToken(null);

type SelectedPlace = { id: string; data: PlaceDoc };

export default function PlacesScreen() {
  const { userDoc, uid } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const places = usePlaces(familyId);

  const [name, setName] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [submitting, setSubmitting] = useState(false);

  const [selected, setSelected] = useState<SelectedPlace | null>(null);

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

  function closeMap() {
    setSelected(null);
  }

  async function handleDirection() {
    if (!selected) return;
    const { lat, lng, name } = selected.data;
    // Try native Google Maps first (Android), fall back to browser URL
    const nativeUrl = `google.navigation:q=${lat},${lng}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`;
    const canOpen = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(canOpen ? nativeUrl : webUrl);
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
          <Pressable onPress={() => setSelected(item)}>
            {({ pressed }) => (
              <Card style={styles.placeCard}>
                <View style={styles.placeRow}>
                  <View style={styles.placeIcon}>
                    <Ionicons name="location" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{item.data.name}</Text>
                    <Text style={styles.placeMeta}>{item.data.radiusMeters}m radius</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.disabled} />
                </View>
              </Card>
            )}
          </Pressable>
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

      {/* Place map modal */}
      <Modal visible={!!selected} animationType="slide" statusBarTranslucent onRequestClose={closeMap}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        {selected && (
          <View style={styles.mapModal}>
            <MapLibreGL.MapView style={styles.mapFull} mapStyle={MAP_STYLE_URL}>
              <MapLibreGL.Camera
                zoomLevel={15}
                centerCoordinate={[selected.data.lng, selected.data.lat]}
                animationDuration={400}
              />

              {/* Radius circle */}
              <MapLibreGL.ShapeSource
                id="placeCircle"
                shape={{
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [selected.data.lng, selected.data.lat] },
                  properties: {},
                }}
              >
                <MapLibreGL.CircleLayer
                  id="placeCircleFill"
                  style={{
                    circleRadius: selected.data.radiusMeters / 3,
                    circleColor: colors.primary,
                    circleOpacity: 0.15,
                    circleStrokeColor: colors.primary,
                    circleStrokeWidth: 2,
                    circleStrokeOpacity: 0.6,
                  }}
                />
              </MapLibreGL.ShapeSource>

              {/* Place pin */}
              <MapLibreGL.PointAnnotation id="placePin" coordinate={[selected.data.lng, selected.data.lat]}>
                <View style={styles.pin}>
                  <Ionicons name="location" size={22} color="#fff" />
                </View>
              </MapLibreGL.PointAnnotation>


            </MapLibreGL.MapView>

            {/* Close button */}
            <Pressable style={styles.closeBtn} onPress={closeMap}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            {/* Bottom panel */}
            <View style={styles.bottomPanel}>
              <View style={styles.placeLabel}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelName}>{selected.data.name}</Text>
                  <Text style={styles.panelMeta}>{selected.data.radiusMeters}m radius</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.dirBtn, pressed && { opacity: 0.8 }]}
                onPress={handleDirection}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.dirBtnText}>Directions</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
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
  mapModal: { flex: 1, backgroundColor: "#000" },
  mapFull: { flex: 1 },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.pill,
    padding: spacing.sm,
    ...shadow,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  placeLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  panelName: { ...typography.body, fontWeight: "700" },
  panelMeta: { ...typography.caption, marginTop: 2 },
  dirBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  dirBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
