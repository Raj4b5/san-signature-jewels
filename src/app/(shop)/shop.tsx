import React, { useMemo, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Container,
  EmptyState,
  ErrorNote,
  Loader,
  OutlineButton,
  Row,
  Screen,
  Small,
  useGridColumns,
} from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/useAsync";
import { plural } from "@/lib/format";

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_low", label: "Price: low to high" },
  { key: "price_high", label: "Price: high to low" },
  { key: "discount", label: "Biggest saving" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const PAGE_SIZE = 24;

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; sort?: string; q?: string }>();
  const { columns, width } = useGridColumns();

  const [search, setSearch] = useState(params.q ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(params.category ?? null);
  const [sort, setSort] = useState<SortKey>(
    SORTS.some((s) => s.key === params.sort) ? (params.sort as SortKey) : "newest",
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [extraPages, setExtraPages] = useState<Awaited<ReturnType<typeof fetchProducts>>>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const debouncedSearch = useDebounced(search);

  const categories = useAsync(fetchCategories, []);

  const products = useAsync(async () => {
    // Any filter change resets pagination.
    setPage(0);
    setExtraPages([]);
    setExhausted(false);
    const rows = await fetchProducts({
      categoryId,
      search: debouncedSearch,
      sort,
      limit: PAGE_SIZE,
    });
    setExhausted(rows.length < PAGE_SIZE);
    return rows;
  }, [categoryId, debouncedSearch, sort]);

  const all = useMemo(
    () => [...(products.data ?? []), ...extraPages],
    [products.data, extraPages],
  );

  async function loadMore() {
    if (loadingMore || exhausted || products.loading) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const rows = await fetchProducts({
        categoryId,
        search: debouncedSearch,
        sort,
        limit: PAGE_SIZE,
        offset: next * PAGE_SIZE,
      });
      setExtraPages((prev) => [...prev, ...rows]);
      setPage(next);
      if (rows.length < PAGE_SIZE) setExhausted(true);
    } catch {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const gridGap = spacing.md;
  const contentWidth = Math.min(width, 1180) - spacing.lg * 2;
  const cardWidth = (contentWidth - gridGap * (columns - 1)) / columns;

  const activeCategory = categories.data?.find((c) => c.id === categoryId);
  const hasFilters = !!categoryId || !!search.trim();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Text style={styles.title}>
            {activeCategory ? activeCategory.name : "The Collection"}
          </Text>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={colors.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or code"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
          >
            <FilterChip
              label="All"
              selected={!categoryId}
              onPress={() => setCategoryId(null)}
            />
            {(categories.data ?? []).map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
              />
            ))}
          </ScrollView>

          <Row justify="space-between">
            <Small>
              {products.loading
                ? "Loading..."
                : `${plural(all.length, "piece")}${exhausted ? "" : "+"}`}
            </Small>

            <Pressable
              onPress={() => setSortOpen((v) => !v)}
              style={({ pressed }) => [styles.sortButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="options-outline" size={15} color={colors.gold} />
              <Text style={styles.sortButtonText}>
                {SORTS.find((s) => s.key === sort)!.label}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.gold} />
            </Pressable>
          </Row>

          {sortOpen && (
            <View style={styles.sortSheet}>
              {SORTS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setSort(option.key);
                    setSortOpen(false);
                  }}
                  style={({ pressed }) => [styles.sortRow, pressed && { opacity: 0.7 }]}
                >
                  <Text
                    style={[
                      styles.sortRowText,
                      sort === option.key && { color: colors.goldLight },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sort === option.key && (
                    <Ionicons name="checkmark" size={16} color={colors.gold} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Container>
      </View>

      {products.loading ? (
        <Loader />
      ) : products.error ? (
        <View style={{ padding: spacing.xl }}>
          <ErrorNote message={products.error} onRetry={products.reload} />
        </View>
      ) : all.length === 0 ? (
        <EmptyState
          title="Nothing matches just yet"
          message={
            hasFilters
              ? "Try a different category, or clear the search to see everything."
              : "New pieces are added daily. Please check back soon."
          }
          action={
            hasFilters ? (
              <OutlineButton
                title="Clear filters"
                onPress={() => {
                  setSearch("");
                  setCategoryId(null);
                }}
              />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          key={`grid-${columns}`}
          data={all}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: gridGap } : undefined}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: gridGap,
            alignSelf: "center",
            width: "100%",
            maxWidth: 1180,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={products.refreshing}
              onRefresh={products.refresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={colors.surface}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.xl }}>
                <Small style={{ textAlign: "center" }}>Loading more...</Small>
              </View>
            ) : exhausted && all.length > PAGE_SIZE ? (
              <View style={{ paddingVertical: spacing.xl }}>
                <Small style={{ textAlign: "center" }}>That is the whole collection</Small>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: colors.gold, borderColor: colors.gold },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.ink }]}>{label}</Text>
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
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.goldLight,
    marginBottom: spacing.md,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    height: "100%",
    ...(process.env.EXPO_OS === "web" ? { outlineStyle: "none" as any } : null),
  },

  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sortButtonText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.gold },

  sortSheet: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sortRowText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
});
