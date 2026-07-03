import Ionicons from "@expo/vector-icons/Ionicons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { addPlace, deletePlace } from "@/lib/places";
import { usePlaces } from "@/lib/useFamilyData";
import type { PlaceDoc } from "@/types";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
MapLibreGL.setAccessToken(null);

type SelectedPlace = { id: string; data: PlaceDoc };
type SearchResult = { displayName: string; lat: number; lng: number };

async function searchLocation(query: string): Promise<SearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { "User-Agent": "FamGuard/1.0" } });
  const json = await res.json() as { display_name: string; lat: string; lon: string }[];
  return json.map((r) => ({ displayName: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}

export default function PlacesScreen() {
  const { userDoc, uid } = useAuth();
  const familyId = userDoc?.currentFamilyId;
  const places = usePlaces(familyId);

  // Add-place form state
  const [name, setName] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [submitting, setSubmitting] = useState(false);

  // Location search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<SearchResult | null>(null);
  const [useCurrentLoc, setUseCurrentLoc] = useState(false);

  // Place map modal state
  const [selected, setSelected] = useState<SelectedPlace | null>(null);

  // ── Search ──────────────────────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchResults([]);
    setPickedLocation(null);
    try {
      const results = await searchLocation(searchQuery.trim());
      if (results.length === 0) Alert.alert("No results", "Try a different search term.");
      setSearchResults(results);
    } catch {
      Alert.alert("Search failed", "Check your internet connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r: SearchResult) {
    setPickedLocation(r);
    setSearchResults([]);
    setSearchQuery(r.displayName.split(",")[0]); // short name in box
    if (!name.trim()) setName(r.displayName.split(",")[0]);
  }

  async function useCurrentLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Location permission required"); return; }
    const pos = await Location.getCurrentPositionAsync({});
    setPickedLocation({ displayName: "Current location", lat: pos.coords.latitude, lng: pos.coords.longitude });
    setSearchQuery("Current location");
    setUseCurrentLoc(true);
  }

  // ── Save ────────────────────────────────────────────────
  async function handleAddPlace() {
    if (!familyId || !uid || !name.trim()) return;
    if (!pickedLocation) { Alert.alert("Pick a location", "Search for a place or use your current location."); return; }
    setSubmitting(true);
    try {
      await addPlace(familyId, {
        name: name.trim(),
        lat: pickedLocation.lat,
        lng: pickedLocation.lng,
        radiusMeters: Number(radiusMeters) || 150,
        createdBy: uid,
      });
      setName("");
      setRadiusMeters("150");
      setSearchQuery("");
      setPickedLocation(null);
      setUseCurrentLoc(false);
    } catch (err) {
      Alert.alert("Couldn't add place", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Place modal ─────────────────────────────────────────
  function closeMap() { setSelected(null); }

  async function handleDelete() {
    if (!selected || !familyId) return;
    Alert.alert("Delete place", `Remove "${selected.data.name}" from saved places?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deletePlace(familyId, selected.id); closeMap(); } },
    ]);
  }

  async function handleDirection() {
    if (!selected) return;
    const { lat, lng, name: pname } = selected.data;
    const nativeUrl = `google.navigation:q=${lat},${lng}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(pname)}`;
    const canOpen = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(canOpen ? nativeUrl : webUrl);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text style={styles.title}>{t("places.title")}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>{t("places.noPlaces")}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            {({ pressed }) => (
              <Card style={[styles.placeCard, pressed && { opacity: 0.75 }] as any}>
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
        ListFooterComponent={
          <Card style={styles.form}>
            <Text style={styles.formTitle}>{t("places.addPlace")}</Text>

            {/* Place name */}
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("places.placeName")}
              placeholderTextColor={colors.disabled}
            />

            {/* Location search */}
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={searchQuery}
                onChangeText={(v) => { setSearchQuery(v); setPickedLocation(null); setUseCurrentLoc(false); }}
                placeholder="Search location…"
                placeholderTextColor={colors.disabled}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <Pressable style={styles.searchBtn} onPress={handleSearch}>
                {searching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="search" size={18} color="#fff" />}
              </Pressable>
            </View>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <View style={styles.results}>
                {searchResults.map((r, i) => (
                  <Pressable key={i} style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: colors.primarySoft }]} onPress={() => pickResult(r)}>
                    <Ionicons name="location-outline" size={14} color={colors.primary} />
                    <Text style={styles.resultText} numberOfLines={2}>{r.displayName}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Picked location preview */}
            {pickedLocation && (
              <View style={styles.pickedRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.pickedText} numberOfLines={1}>{pickedLocation.displayName}</Text>
              </View>
            )}

            {/* Use current location shortcut */}
            {!pickedLocation && (
              <Pressable style={styles.currentLocBtn} onPress={useCurrentLocation}>
                <Ionicons name="locate" size={14} color={colors.primary} />
                <Text style={styles.currentLocText}>Use my current location</Text>
              </Pressable>
            )}

            {/* Radius */}
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
              disabled={submitting || !name.trim() || !pickedLocation}
              loading={submitting}
              icon="add-circle-outline"
            />
          </Card>
        }
      />

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
              <MapLibreGL.ShapeSource
                id="placeCircle"
                shape={{ type: "Feature", geometry: { type: "Point", coordinates: [selected.data.lng, selected.data.lat] }, properties: {} }}
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
              <MapLibreGL.PointAnnotation id="placePin" coordinate={[selected.data.lng, selected.data.lat]}>
                <View style={styles.pin}><Ionicons name="location" size={22} color="#fff" /></View>
              </MapLibreGL.PointAnnotation>
            </MapLibreGL.MapView>

            <Pressable style={styles.closeBtn} onPress={closeMap}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <View style={styles.bottomPanel}>
              <View style={styles.placeLabel}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelName}>{selected.data.name}</Text>
                  <Text style={styles.panelMeta}>{selected.data.radiusMeters}m radius</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.dirBtn, { flex: 1 }, pressed && { opacity: 0.8 }]}
                  onPress={handleDirection}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                  <Text style={styles.dirBtnText}>Directions</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
  },
  placeInfo: { flex: 1 },
  placeName: { ...typography.body, fontWeight: "600" },
  placeMeta: { ...typography.caption, marginTop: 2 },
  form: { gap: spacing.md, marginTop: spacing.sm },
  formTitle: { ...typography.sectionLabel },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, backgroundColor: colors.surface, color: colors.text,
  },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  results: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultText: { flex: 1, fontSize: 13, color: colors.text },
  pickedRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md,
  },
  pickedText: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: "600" },
  currentLocBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  currentLocText: { fontSize: 13, color: colors.primary },
  mapModal: { flex: 1, backgroundColor: "#000" },
  mapFull: { flex: 1 },
  closeBtn: {
    position: "absolute", top: 48, right: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.pill, padding: spacing.sm, ...shadow,
  },
  pin: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", ...shadow,
  },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md, ...shadow,
  },
  placeLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  panelName: { ...typography.body, fontWeight: "700" },
  panelMeta: { ...typography.caption, marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dirBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md,
  },
  dirBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fee2e2",
    alignItems: "center", justifyContent: "center",
  },
});
