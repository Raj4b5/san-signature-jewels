import React from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, gradients, radius, spacing } from "@/theme";
import {
  Container,
  EmptyState,
  ErrorNote,
  GoldButton,
  GoldRule,
  Loader,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  TextButton,
  useGridColumns,
} from "@/components/ui";
import { Monogram, Wordmark } from "@/components/Brand";
import { ProductCard } from "@/components/ProductCard";
import { fetchCategories, fetchProducts, fetchSettings } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { callShop, openMaps, openWhatsApp } from "@/lib/contact";
import type { Category, Product, Settings } from "@/lib/types";

type HomeData = {
  settings: Settings;
  categories: Category[];
  newest: Product[];
  featured: Product[];
};

/** The four promises printed down the right side of the visiting card. */
const PROMISES = [
  {
    icon: "diamond-outline" as const,
    title: "Handmade & Designer",
    body: "Unique designs crafted with love and perfection.",
  },
  {
    icon: "sparkles-outline" as const,
    title: "Traditional, Trendy, Elegant",
    body: "A perfect blend of timeless beauty and modern style.",
  },
  {
    icon: "gift-outline" as const,
    title: "Bridal & Occasion",
    body: "For weddings, festivals and every celebration.",
  },
  {
    icon: "flower-outline" as const,
    title: "Perfect for Gifting",
    body: "Make every moment memorable.",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { columns, isWide, width } = useGridColumns();

  const state = useAsync<HomeData>(async () => {
    const [settings, categories, newest, featured] = await Promise.all([
      fetchSettings(),
      fetchCategories(),
      fetchProducts({ sort: "newest", limit: 10, inStockOnly: true }),
      fetchProducts({ featuredOnly: true, limit: 8, inStockOnly: true }),
    ]);
    return { settings, categories, newest, featured };
  }, []);

  if (state.loading) return <Loader label="Opening the collection" />;

  if (state.error && !state.data) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <ErrorNote message={state.error} onRetry={state.reload} />
        </View>
      </Screen>
    );
  }

  const { settings, categories, newest, featured } = state.data!;
  const railWidth = isWide ? 240 : 168;
  const gridGap = spacing.md;
  const contentWidth = Math.min(width, 1180) - spacing.lg * 2;
  const gridCardWidth = (contentWidth - gridGap * (columns - 1)) / columns;

  return (
    <Screen
      scroll
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {/* ---------------------------------------------------------- Hero */}
      <LinearGradient
        colors={["#1C1309", "#0B0705"]}
        style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}
      >
        <Monogram size={64} />
        <Spacer size={spacing.lg} />
        <Wordmark size="lg" tagline={settings.tagline} />
        <Spacer size={spacing.xl} />
        <Text style={styles.heroKicker}>Handcrafted jewellery for every special moment</Text>

        <View style={{ width: "100%", maxWidth: 320, marginTop: spacing.xl }}>
          <GoldButton
            title="Browse the collection"
            onPress={() => router.push("/shop")}
            icon={<Ionicons name="diamond-outline" size={16} color={colors.ink} />}
          />
        </View>
      </LinearGradient>

      {settings.sale_banner_active && !!settings.sale_banner_text && (
        <Pressable onPress={() => router.push("/shop?sort=discount")}>
          <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saleBanner}>
            <Ionicons name="pricetag-outline" size={15} color={colors.ink} />
            <Text style={styles.saleBannerText}>{settings.sale_banner_text}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.ink} />
          </LinearGradient>
        </Pressable>
      )}

      {!!settings.announcement && (
        <View style={styles.announcement}>
          <Ionicons name="information-circle-outline" size={15} color={colors.gold} />
          <Text style={styles.announcementText}>{settings.announcement}</Text>
        </View>
      )}

      <Container style={{ paddingHorizontal: spacing.lg }}>
        {/* ------------------------------------------------- Categories */}
        {categories.length > 0 && (
          <>
            <Spacer size={spacing.xxl} />
            <SectionHeader title="Shop by category" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
            >
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => router.push(`/shop?category=${category.id}`)}
                  style={({ pressed }) => [styles.categoryPill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.categoryPillText}>{category.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* --------------------------------------------- New this week */}
        {newest.length > 0 && (
          <>
            <Spacer size={spacing.xxl} />
            <SectionHeader
              title="Just arrived"
              action={<TextButton title="See all" onPress={() => router.push("/shop")} />}
            />
            <FlatList
              horizontal
              data={newest}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  width={railWidth}
                  onPress={() => router.push(`/product/${item.id}`)}
                />
              )}
            />
          </>
        )}

        {/* ----------------------------------------------- Signature */}
        {featured.length > 0 && (
          <>
            <Spacer size={spacing.xxl} />
            <SectionHeader
              title="Signature pieces"
              action={<TextButton title="See all" onPress={() => router.push("/shop")} />}
            />
            <View style={[styles.grid, { gap: gridGap }]}>
              {featured.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  width={gridCardWidth}
                  onPress={() => router.push(`/product/${item.id}`)}
                />
              ))}
            </View>
          </>
        )}

        {newest.length === 0 && featured.length === 0 && (
          <EmptyState
            title="The collection is being photographed"
            message="New handcrafted pieces are added here every day. Do check back shortly."
          />
        )}

        {/* ------------------------------------------------- Promises */}
        <Spacer size={spacing.xxxl} />
        <GoldRule />
        <Spacer size={spacing.xl} />

        <View style={[styles.promiseWrap, isWide && { flexDirection: "row", flexWrap: "wrap" }]}>
          {PROMISES.map((promise) => (
            <View
              key={promise.title}
              style={[styles.promise, isWide && { width: "48%" }]}
            >
              <View style={styles.promiseIcon}>
                <Ionicons name={promise.icon} size={17} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promiseTitle}>{promise.title}</Text>
                <Small style={{ marginTop: 2 }}>{promise.body}</Small>
              </View>
            </View>
          ))}
        </View>

        {/* -------------------------------------------------- Contact */}
        <Spacer size={spacing.xxl} />
        <View style={styles.contactCard}>
          <Text style={styles.contactHeading}>Visit us or say hello</Text>
          <Small style={{ marginTop: spacing.sm, lineHeight: 20 }}>{settings.address}</Small>

          <Spacer size={spacing.lg} />
          <Row gap={spacing.sm} wrap>
            <ContactAction
              icon="logo-whatsapp"
              label="WhatsApp"
              onPress={() =>
                openWhatsApp(settings, "Hello San Signature Jewels, I would like to know more about your collection.")
              }
            />
            <ContactAction icon="call-outline" label="Call" onPress={() => callShop(settings)} />
            <ContactAction icon="location-outline" label="Directions" onPress={() => openMaps(settings)} />
          </Row>
        </View>

        <Spacer size={spacing.xxl} />
        <Text style={styles.footerNote}>Thank you for supporting handmade & local</Text>
        <Spacer size={spacing.lg} />
      </Container>
    </Screen>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
      <SectionTitle>{title}</SectionTitle>
      {action}
    </Row>
  );
}

function ContactAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.contactAction, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.contactActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroKicker: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    textAlign: "center",
  },

  saleBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  saleBannerText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.ink,
    textAlign: "center",
  },

  announcement: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  announcementText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  categoryPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryPillText: { fontFamily: fonts.body, fontSize: 13, color: colors.cream },

  grid: { flexDirection: "row", flexWrap: "wrap" },

  promiseWrap: { gap: spacing.lg },
  promise: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  promiseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  promiseTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.cream,
  },

  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  contactHeading: { fontFamily: fonts.display, fontSize: 21, color: colors.goldLight },

  contactAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
  },
  contactActionText: { fontFamily: fonts.body, fontSize: 13, color: colors.cream },

  footerNote: {
    fontFamily: fonts.script,
    fontSize: 17,
    color: colors.gold,
    textAlign: "center",
  },
});
