import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Container,
  Divider,
  ErrorNote,
  Field,
  GoldButton,
  InfoNote,
  Loader,
  OutlineButton,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import {
  deleteProduct,
  fetchCategories,
  fetchProduct,
  nextProductCode,
  saveProduct,
  type ProductDraft,
} from "@/lib/api";
import {
  captureImage,
  deleteImageByUrl,
  MAX_IMAGES_PER_PRODUCT,
  pickImages,
  uploadImage,
  type PickedImage,
} from "@/lib/images";
import { useAsync } from "@/lib/useAsync";
import { discountPercent, money } from "@/lib/format";

type Draft = {
  code: string;
  name: string;
  description: string;
  category_id: string | null;
  mrp: string;
  price: string;
  stock: string;
  material: string;
  weight_grams: string;
  images: string[];
  is_active: boolean;
  is_featured: boolean;
};

const EMPTY: Draft = {
  code: "",
  name: "",
  description: "",
  category_id: null,
  mrp: "",
  price: "",
  stock: "1",
  material: "",
  weight_grams: "",
  images: [],
  is_active: true,
  is_featured: false,
};

export default function ProductEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isNew = id === "new";

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const categories = useAsync(fetchCategories, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (isNew) {
          const code = await nextProductCode();
          if (!cancelled) setDraft({ ...EMPTY, code });
        } else {
          const product = await fetchProduct(id);
          if (cancelled) return;
          if (!product) {
            setSaveError("That piece no longer exists.");
          } else {
            setDraft({
              code: product.code,
              name: product.name,
              description: product.description ?? "",
              category_id: product.category_id,
              mrp: product.mrp ? String(product.mrp) : "",
              price: String(product.price),
              stock: String(product.stock),
              material: product.material ?? "",
              weight_grams: product.weight_grams ? String(product.weight_grams) : "",
              images: product.images ?? [],
              is_active: product.is_active,
              is_featured: product.is_featured,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setSaveError(e instanceof Error ? e.message : "Could not load this piece.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function addImages(source: "gallery" | "camera") {
    setSaveError(null);
    const remaining = MAX_IMAGES_PER_PRODUCT - draft.images.length;

    if (remaining <= 0) {
      setSaveError(`A piece can have up to ${MAX_IMAGES_PER_PRODUCT} photos.`);
      return;
    }

    try {
      let picked: PickedImage[] = [];
      if (source === "camera") {
        const shot = await captureImage();
        picked = shot ? [shot] : [];
      } else {
        picked = await pickImages(remaining);
      }
      if (picked.length === 0) return;

      for (let i = 0; i < picked.length; i++) {
        setUploading(
          picked.length === 1 ? "Uploading photo..." : `Uploading photo ${i + 1} of ${picked.length}...`,
        );
        const url = await uploadImage(picked[i]);
        setDraft((prev) => ({ ...prev, images: [...prev.images, url] }));
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not add that photo.");
    } finally {
      setUploading(null);
    }
  }

  function removeImage(url: string) {
    setDraft((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
    // Fire and forget: the record is what matters, the file is cleanup.
    deleteImageByUrl(url);
  }

  function makeCover(url: string) {
    setDraft((prev) => ({ ...prev, images: [url, ...prev.images.filter((u) => u !== url)] }));
  }

  /** Quick "x% off" buttons: set MRP from the current price, then discount it. */
  function applyQuickDiscount(percent: number) {
    const base = Number(draft.mrp) > Number(draft.price) ? Number(draft.mrp) : Number(draft.price);
    if (!base || Number.isNaN(base)) return;
    setDraft((prev) => ({
      ...prev,
      mrp: String(Math.round(base)),
      price: String(Math.round(base * (1 - percent / 100))),
    }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof Draft, string>> = {};

    if (draft.name.trim().length < 2) next.name = "Give this piece a name.";
    if (!draft.code.trim()) next.code = "A product code is required.";

    const price = Number(draft.price);
    if (!draft.price.trim() || Number.isNaN(price) || price < 0) {
      next.price = "Enter the selling price.";
    }

    if (draft.mrp.trim()) {
      const mrp = Number(draft.mrp);
      if (Number.isNaN(mrp) || mrp < 0) next.mrp = "Enter a valid amount.";
      else if (mrp > 0 && mrp < price) next.mrp = "The struck-through price must be higher.";
    }

    const stock = Number(draft.stock);
    if (!Number.isInteger(stock) || stock < 0) next.stock = "Enter a whole number, 0 or more.";

    if (draft.weight_grams.trim() && Number.isNaN(Number(draft.weight_grams))) {
      next.weight_grams = "Enter a number, e.g. 24.5";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    setSaveError(null);
    if (!validate()) {
      setSaveError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const payload: ProductDraft = {
        ...(isNew ? {} : { id }),
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category_id: draft.category_id,
        mrp: draft.mrp.trim() ? Number(draft.mrp) : null,
        price: Number(draft.price),
        stock: Number(draft.stock),
        material: draft.material.trim() || null,
        weight_grams: draft.weight_grams.trim() ? Number(draft.weight_grams) : null,
        images: draft.images,
        tags: [],
        is_active: draft.is_active,
        is_featured: draft.is_featured,
      };

      await saveProduct(payload);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save this piece.";
      setSaveError(
        message.includes("duplicate key") || message.includes("products_code_key")
          ? `The code ${draft.code} is already used by another piece.`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    const remove = async () => {
      try {
        await deleteProduct(id);
        router.back();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Could not delete this piece.");
      }
    };

    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete "${draft.name}" permanently? This cannot be undone.`)) remove();
      return;
    }

    Alert.alert(
      "Delete this piece?",
      `"${draft.name}" will be removed permanently. This cannot be undone.\n\nTo hide it from the shop instead, turn off "Show in shop".`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ],
    );
  }

  if (!ready || categories.loading) return <Loader />;

  const off = discountPercent(Number(draft.price) || 0, Number(draft.mrp) || null);
  const categoryOptions = (categories.data ?? []).map((c) => ({ label: c.name, value: c.id }));

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
          <Row justify="space-between">
            <Row gap={spacing.md}>
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={22} color={colors.cream} />
              </Pressable>
              <Text style={styles.headerTitle}>{isNew ? "New piece" : "Edit piece"}</Text>
            </Row>
            {!isNew && (
              <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Delete piece">
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              </Pressable>
            )}
          </Row>
        </Container>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Container width={720} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            {/* -------------------------------------------- Photos */}
            <SectionTitle style={{ fontSize: 19 }}>Photos</SectionTitle>
            <Small style={{ marginTop: 2 }}>
              The first photo is the cover customers see. Up to {MAX_IMAGES_PER_PRODUCT}.
            </Small>
            <Spacer size={spacing.md} />

            <View style={styles.photoGrid}>
              {draft.images.map((url, index) => (
                <View key={url} style={styles.photoWrap}>
                  <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />

                  {index === 0 && (
                    <View style={styles.coverTag}>
                      <Text style={styles.coverTagText}>Cover</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => removeImage(url)}
                    style={styles.photoRemove}
                    hitSlop={6}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={13} color={colors.cream} />
                  </Pressable>

                  {index !== 0 && (
                    <Pressable
                      onPress={() => makeCover(url)}
                      style={styles.photoCoverButton}
                      accessibilityLabel="Make this the cover photo"
                    >
                      <Ionicons name="star-outline" size={12} color={colors.gold} />
                    </Pressable>
                  )}
                </View>
              ))}

              {draft.images.length < MAX_IMAGES_PER_PRODUCT && !uploading && (
                <>
                  <Pressable
                    onPress={() => addImages("gallery")}
                    style={({ pressed }) => [styles.photoAdd, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="images-outline" size={20} color={colors.gold} />
                    <Text style={styles.photoAddText}>Gallery</Text>
                  </Pressable>

                  {Platform.OS !== "web" && (
                    <Pressable
                      onPress={() => addImages("camera")}
                      style={({ pressed }) => [styles.photoAdd, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name="camera-outline" size={20} color={colors.gold} />
                      <Text style={styles.photoAddText}>Camera</Text>
                    </Pressable>
                  )}
                </>
              )}

              {!!uploading && (
                <View style={[styles.photoAdd, { borderStyle: "solid" }]}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
                  <Text style={styles.photoAddText}>Uploading</Text>
                </View>
              )}
            </View>

            {!!uploading && (
              <>
                <Spacer size={spacing.md} />
                <InfoNote message={uploading} />
              </>
            )}

            {draft.images.length === 0 && !uploading && (
              <>
                <Spacer size={spacing.md} />
                <InfoNote message="A piece with no photo will still be listed, but it rarely sells. Add at least one." />
              </>
            )}

            {/* --------------------------------------------- Details */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 19 }}>Details</SectionTitle>
            <Spacer size={spacing.md} />

            <View style={{ gap: spacing.md }}>
              <Field
                label="Name"
                required
                value={draft.name}
                onChangeText={(v) => set("name", v)}
                error={errors.name}
                placeholder="Emerald Kundan Choker Set"
                autoCapitalize="words"
              />

              <Row gap={spacing.md} align="flex-start">
                <Field
                  label="Code"
                  required
                  containerStyle={{ flex: 1 }}
                  value={draft.code}
                  onChangeText={(v) => set("code", v.toUpperCase())}
                  error={errors.code}
                  placeholder="SJ-0001"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Category"
                    value={draft.category_id}
                    options={categoryOptions}
                    onChange={(v) => set("category_id", v)}
                    placeholder="Uncategorised"
                    allowClear
                  />
                </View>
              </Row>

              <Field
                label="Description"
                value={draft.description}
                onChangeText={(v) => set("description", v)}
                placeholder="Hand-set green stones with pearl drops. Adjustable dori."
                multiline
              />

              <Row gap={spacing.md} align="flex-start">
                <Field
                  label="Material"
                  containerStyle={{ flex: 1 }}
                  value={draft.material}
                  onChangeText={(v) => set("material", v)}
                  placeholder="Gold-plated brass, AD stones"
                />
                <Field
                  label="Weight (g)"
                  containerStyle={{ width: 110 }}
                  value={draft.weight_grams}
                  onChangeText={(v) => set("weight_grams", v)}
                  error={errors.weight_grams}
                  placeholder="45"
                  keyboardType="decimal-pad"
                />
              </Row>
            </View>

            {/* ----------------------------------------------- Price */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 19 }}>Price &amp; stock</SectionTitle>
            <Spacer size={spacing.md} />

            <Row gap={spacing.md} align="flex-start">
              <Field
                label="Selling price"
                required
                containerStyle={{ flex: 1 }}
                value={draft.price}
                onChangeText={(v) => set("price", v.replace(/[^0-9.]/g, ""))}
                error={errors.price}
                placeholder="1450"
                keyboardType="decimal-pad"
              />
              <Field
                label="Was (optional)"
                containerStyle={{ flex: 1 }}
                value={draft.mrp}
                onChangeText={(v) => set("mrp", v.replace(/[^0-9.]/g, ""))}
                error={errors.mrp}
                placeholder="1990"
                keyboardType="decimal-pad"
                hint="Shown struck through"
              />
            </Row>

            <Spacer size={spacing.md} />
            <Row gap={spacing.sm} wrap>
              <Small style={{ fontSize: 12 }}>Quick discount:</Small>
              {[10, 20, 30, 40, 50].map((percent) => (
                <Pressable
                  key={percent}
                  onPress={() => applyQuickDiscount(percent)}
                  style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.quickChipText}>{percent}%</Text>
                </Pressable>
              ))}
              {off > 0 && (
                <Pressable
                  onPress={() => setDraft((p) => ({ ...p, price: p.mrp || p.price, mrp: "" }))}
                  style={({ pressed }) => [
                    styles.quickChip,
                    { borderColor: colors.danger },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.quickChipText, { color: colors.danger }]}>Clear</Text>
                </Pressable>
              )}
            </Row>

            {off > 0 && (
              <>
                <Spacer size={spacing.md} />
                <View style={styles.pricePreview}>
                  <Text style={styles.previewPrice}>{money(Number(draft.price))}</Text>
                  <Text style={styles.previewMrp}>{money(Number(draft.mrp))}</Text>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>{off}% OFF</Text>
                  </View>
                </View>
              </>
            )}

            <Spacer size={spacing.md} />
            <Field
              label="Pieces in stock"
              required
              containerStyle={{ width: 160 }}
              value={draft.stock}
              onChangeText={(v) => set("stock", v.replace(/[^0-9]/g, ""))}
              error={errors.stock}
              placeholder="1"
              keyboardType="number-pad"
              hint="0 shows as sold out"
            />

            {/* ------------------------------------------ Visibility */}
            <Spacer size={spacing.xxl} />
            <View style={styles.card}>
              <ToggleRow
                label="Show in shop"
                hint="Turn off to hide without deleting"
                value={draft.is_active}
                onChange={(v) => set("is_active", v)}
              />
              <Divider />
              <ToggleRow
                label="Feature on the home page"
                hint="Appears under Signature pieces"
                value={draft.is_featured}
                onChange={(v) => set("is_featured", v)}
              />
            </View>

            {!!saveError && (
              <>
                <Spacer size={spacing.lg} />
                <ErrorNote message={saveError} />
              </>
            )}
          </Container>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
          <Row gap={spacing.md}>
            <OutlineButton
              title="Cancel"
              tone="muted"
              style={{ flex: 1 }}
              onPress={() => router.back()}
            />
            <GoldButton
              title={isNew ? "Add to shop" : "Save changes"}
              style={{ flex: 2 }}
              onPress={save}
              loading={saving}
              disabled={!!uploading}
            />
          </Row>
        </Container>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Row justify="space-between" style={{ paddingVertical: spacing.md }}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!hint && <Small style={{ fontSize: 12, marginTop: 1 }}>{hint}</Small>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.goldDeep }}
        thumbColor={value ? colors.goldLight : colors.textFaint}
        ios_backgroundColor={colors.border}
      />
    </Row>
  );
}

const PHOTO = 96;

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.goldLight },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoWrap: {
    width: PHOTO,
    height: PHOTO * 1.15,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  photo: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(8,5,3,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCoverButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(8,5,3,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  coverTagText: { fontFamily: fonts.bodySemi, fontSize: 8.5, letterSpacing: 0.6, color: colors.ink },

  photoAdd: {
    width: PHOTO,
    height: PHOTO * 1.15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  photoAddText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },

  quickChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  quickChipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.gold },

  pricePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  previewPrice: { fontFamily: fonts.bodySemi, fontSize: 19, color: colors.goldLight },
  previewMrp: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  previewBadge: {
    backgroundColor: colors.emerald,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  previewBadgeText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.goldPale },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14.5, color: colors.cream },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSunken,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
