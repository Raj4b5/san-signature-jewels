import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, shadow, spacing } from "@/theme";
import {
  Badge,
  Container,
  EmptyState,
  ErrorNote,
  GoldButton,
  InfoNote,
  Loader,
  OutlineButton,
  Row,
  Screen,
  Small,
  Spacer,
  TextButton,
} from "@/components/ui";
import {
  adminFetchProducts,
  bulkDiscount,
  clearDiscount,
  setProductActive,
} from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/useAsync";
import { money, plural } from "@/lib/format";
import type { Product } from "@/lib/types";

const STATUSES = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "hidden", label: "Hidden" },
  { key: "sold_out", label: "Sold out" },
] as const;

type StatusKey = (typeof STATUSES)[number]["key"];

export default function AdminProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string; bulk?: string }>();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>(
    STATUSES.some((s) => s.key === params.status) ? (params.status as StatusKey) : "all",
  );
  const [bulkMode, setBulkMode] = useState(params.bulk === "1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPercent, setBulkPercent] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const state = useAsync(
    () => adminFetchProducts({ search: debouncedSearch, status, limit: 200 }),
    [debouncedSearch, status],
  );

  // Returning from the editor should show the edit.
  useFocusEffect(
    React.useCallback(() => {
      state.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    if (!bulkMode) setSelected(new Set());
  }, [bulkMode]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const rows = state.data ?? [];
    setSelected(
      selected.size === rows.length ? new Set() : new Set(rows.map((p) => p.id)),
    );
  }

  async function runBulkDiscount() {
    const percent = Number(bulkPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      setNotice("Enter a discount between 1 and 99.");
      return;
    }

    setBulkBusy(true);
    setNotice(null);
    try {
      const count = await bulkDiscount([...selected], percent);
      setNotice(`${percent}% off applied to ${plural(count, "piece")}.`);
      setSelected(new Set());
      setBulkPercent("");
      state.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not apply the discount.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runClearDiscount() {
    setBulkBusy(true);
    setNotice(null);
    try {
      const count = await clearDiscount([...selected]);
      setNotice(
        count === 0
          ? "None of the selected pieces had a discount."
          : `Discount removed from ${plural(count, "piece")}.`,
      );
      setSelected(new Set());
      state.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not clear the discounts.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleActive(product: Product) {
    // Optimistic: the list should not flicker for a one-field change.
    state.setData(
      (state.data ?? []).map((p) =>
        p.id === product.id ? { ...p, is_active: !p.is_active } : p,
      ),
    );
    try {
      await setProductActive(product.id, !product.is_active);
    } catch {
      state.refresh();
    }
  }

  const rows = state.data ?? [];

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Row justify="space-between">
            <Row gap={spacing.md}>
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={22} color={colors.cream} />
              </Pressable>
              <Text style={styles.headerTitle}>Pieces</Text>
            </Row>

            <TextButton
              title={bulkMode ? "Done" : "Select"}
              onPress={() => setBulkMode((v) => !v)}
            />
          </Row>

          <Spacer size={spacing.md} />
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or code"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
          >
            {STATUSES.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setStatus(option.key)}
                style={({ pressed }) => [
                  styles.chip,
                  status === option.key && { backgroundColor: colors.gold, borderColor: colors.gold },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[styles.chipText, status === option.key && { color: colors.ink }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Container>
      </View>

      {/* ------------------------------------------------- Bulk panel */}
      {bulkMode && (
        <View style={styles.bulkPanel}>
          <Container style={{ paddingHorizontal: spacing.lg }}>
            <Row justify="space-between">
              <Small>
                {selected.size === 0 ? "Select pieces to price together" : `${selected.size} selected`}
              </Small>
              <TextButton
                title={selected.size === rows.length && rows.length > 0 ? "Clear all" : "Select all"}
                onPress={selectAll}
              />
            </Row>

            {selected.size > 0 && (
              <>
                <Spacer size={spacing.md} />
                <Row gap={spacing.sm} align="center">
                  <TextInput
                    value={bulkPercent}
                    onChangeText={(v) => setBulkPercent(v.replace(/[^0-9]/g, ""))}
                    placeholder="20"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    maxLength={2}
                    style={styles.bulkInput}
                  />
                  <Text style={styles.bulkPercent}>% off</Text>
                  <GoldButton
                    title="Apply"
                    size="sm"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={runBulkDiscount}
                    loading={bulkBusy}
                  />
                  <OutlineButton
                    title="Clear"
                    size="sm"
                    tone="muted"
                    full={false}
                    onPress={runClearDiscount}
                    disabled={bulkBusy}
                  />
                </Row>
                <Spacer size={spacing.sm} />
                <Small style={{ fontSize: 11.5 }}>
                  The current price becomes the struck-through price, and the new price is
                  calculated from it.
                </Small>
              </>
            )}

            {!!notice && (
              <>
                <Spacer size={spacing.md} />
                <InfoNote message={notice} tone="emerald" />
              </>
            )}
          </Container>
        </View>
      )}

      {state.loading ? (
        <Loader />
      ) : state.error ? (
        <View style={{ padding: spacing.xl }}>
          <ErrorNote message={state.error} onRetry={state.reload} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search ? "Nothing matches" : "No pieces yet"}
          message={
            search
              ? "Try a different name or code."
              : "Add your first piece and it will appear in the shop straight away."
          }
          action={
            !search ? (
              <GoldButton
                title="Add a piece"
                onPress={() => router.push("/admin/product/new")}
              />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: 110,
            gap: spacing.sm,
            alignSelf: "center",
            width: "100%",
            maxWidth: 1180,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={state.refresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={colors.surface}
            />
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              bulkMode={bulkMode}
              selected={selected.has(item.id)}
              onPress={() =>
                bulkMode ? toggleSelect(item.id) : router.push(`/admin/product/${item.id}`)
              }
              onToggleActive={() => toggleActive(item)}
            />
          )}
        />
      )}

      {!bulkMode && (
        <Pressable
          onPress={() => router.push("/admin/product/new")}
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + spacing.xl },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityLabel="Add a new piece"
        >
          <Ionicons name="add" size={26} color={colors.ink} />
        </Pressable>
      )}
    </Screen>
  );
}

function ProductRow({
  product,
  bulkMode,
  selected,
  onPress,
  onToggleActive,
}: {
  product: Product;
  bulkMode: boolean;
  selected: boolean;
  onPress: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && { borderColor: colors.gold, backgroundColor: "rgba(212,175,55,0.07)" },
        pressed && { opacity: 0.85 },
      ]}
    >
      {bulkMode && (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected && <Ionicons name="checkmark" size={13} color={colors.ink} />}
        </View>
      )}

      {product.images?.[0] ? (
        <Image source={{ uri: product.images[0] }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="image-outline" size={16} color={colors.goldMuted} />
        </View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.code}>
          {product.code}
          {product.categories?.name ? `  ·  ${product.categories.name}` : ""}
        </Text>

        <Row gap={spacing.sm} style={{ marginTop: 2 }} wrap>
          <Text style={styles.price}>{money(product.price)}</Text>
          {product.discount_percent > 0 && !!product.mrp && (
            <>
              <Text style={styles.mrp}>{money(product.mrp)}</Text>
              <Badge label={`${product.discount_percent}% off`} tone="emerald" />
            </>
          )}
        </Row>

        <Row gap={spacing.sm} style={{ marginTop: 3 }} wrap>
          {product.stock === 0 ? (
            <Badge label="Sold out" tone="danger" />
          ) : product.stock <= 2 ? (
            <Badge label={`${product.stock} left`} tone="warning" />
          ) : (
            <Small style={{ fontSize: 11 }}>{product.stock} in stock</Small>
          )}
          {product.stock > (product.available_stock ?? product.stock) && (
            <Badge
              label={`${product.stock - (product.available_stock ?? product.stock)} on hold`}
              tone="gold"
            />
          )}
          {!product.is_active && <Badge label="Hidden" tone="muted" />}
          {product.is_featured && <Badge label="Featured" tone="gold" />}
        </Row>
      </View>

      {!bulkMode && (
        <Pressable
          onPress={onToggleActive}
          hitSlop={8}
          accessibilityLabel={product.is_active ? "Hide from shop" : "Show in shop"}
          style={styles.eye}
        >
          <Ionicons
            name={product.is_active ? "eye-outline" : "eye-off-outline"}
            size={18}
            color={product.is_active ? colors.gold : colors.textFaint}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.goldLight },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },

  bulkPanel: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  bulkInput: {
    width: 62,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSunken,
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    textAlign: "center",
  },
  bulkPercent: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },

  thumb: { width: 56, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  thumbFallback: { alignItems: "center", justifyContent: "center" },

  name: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  code: { fontFamily: fonts.body, fontSize: 10.5, letterSpacing: 0.8, color: colors.textFaint },
  price: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.goldLight },
  mrp: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  eye: { padding: spacing.sm },

  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
});
