import React, { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Badge,
  Container,
  Divider,
  ErrorNote,
  GoldButton,
  GoldRule,
  Loader,
  OutlineButton,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";
import { fetchProduct, fetchRelated, fetchSettings } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { money } from "@/lib/format";
import { enquiryMessage, openWhatsApp } from "@/lib/contact";
import { useCart } from "@/store/cart";
import type { Product, Settings } from "@/lib/types";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const add = useCart((s) => s.add);
  const inBag = useCart((s) => s.lines.find((l) => l.productId === id)?.quantity ?? 0);

  const [slide, setSlide] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = useAsync<{ product: Product | null; related: Product[]; settings: Settings }>(
    async () => {
      const [product, settings] = await Promise.all([fetchProduct(id), fetchSettings()]);
      const related = product ? await fetchRelated(product) : [];
      return { product, related, settings };
    },
    [id],
  );

  function flash(message: string) {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2600);
  }

  if (state.loading) return <Loader />;

  if (state.error || !state.data?.product) {
    return (
      <Screen>
        <BackBar onBack={() => router.back()} top={insets.top} />
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <ErrorNote
            message={state.error ?? "This piece is no longer available."}
            onRetry={state.reload}
          />
          <Spacer size={spacing.lg} />
          <OutlineButton title="Back to the collection" onPress={() => router.push("/shop")} />
        </View>
      </Screen>
    );
  }

  const { product, related, settings } = state.data;
  const soldOut = product.stock <= 0;
  const available = product.available_stock ?? product.stock;
  // In stock, but held by another shopper who is paying right now.
  const reserved = !soldOut && available <= 0;
  const hasDiscount = product.discount_percent > 0 && !!product.mrp;
  const canAddMore = inBag < available;

  // The gallery is square-ish on phones and capped on desktop so a
  // portrait photo does not push the buy button off the screen.
  const galleryWidth = Math.min(width, 560);
  const galleryHeight = galleryWidth * 1.15;

  const images = product.images?.length ? product.images : [null];

  function addToBag() {
    const result = add(product!, 1);
    flash(result.ok ? "Added to your bag" : result.message ?? "Could not add this piece.");
  }

  return (
    <Screen>
      <BackBar onBack={() => router.back()} top={insets.top} />

      <ScrollView contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        <Container width={900} style={{ alignItems: "center" }}>
          {/* ------------------------------------------------- Gallery */}
          <View style={{ width: galleryWidth }}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => String(index)}
              onMomentumScrollEnd={(e) =>
                setSlide(Math.round(e.nativeEvent.contentOffset.x / galleryWidth))
              }
              renderItem={({ item }) =>
                item ? (
                  <Image
                    source={{ uri: item }}
                    style={{ width: galleryWidth, height: galleryHeight }}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View
                    style={[
                      { width: galleryWidth, height: galleryHeight },
                      styles.galleryFallback,
                    ]}
                  >
                    <Ionicons name="diamond-outline" size={40} color={colors.goldMuted} />
                    <Small style={{ marginTop: spacing.md }}>Photograph coming soon</Small>
                  </View>
                )
              }
            />

            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.dot, index === slide && styles.dotActive]}
                  />
                ))}
              </View>
            )}

            {(soldOut || reserved) && (
              <View style={styles.soldOutBanner}>
                <Text style={[styles.soldOutBannerText, reserved && { color: colors.goldLight }]}>
                  {soldOut ? "Sold out" : "Reserved"}
                </Text>
              </View>
            )}
          </View>

          {/* --------------------------------------------------- Detail */}
          <View style={{ width: "100%", paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
            {!!product.categories?.name && (
              <Text style={styles.category}>{product.categories.name}</Text>
            )}
            <SectionTitle style={{ fontSize: 26, marginTop: spacing.xs }}>
              {product.name}
            </SectionTitle>
            <Text style={styles.code}>{product.code}</Text>

            <Row gap={spacing.md} style={{ marginTop: spacing.md }} align="baseline" wrap>
              <Text style={styles.price}>{money(product.price)}</Text>
              {hasDiscount && (
                <>
                  <Text style={styles.mrp}>{money(product.mrp!)}</Text>
                  <Badge label={`${product.discount_percent}% off`} tone="emerald" />
                </>
              )}
            </Row>
            <Small style={{ fontSize: 11, marginTop: 2 }}>Inclusive of all taxes</Small>

            {!soldOut && !reserved && available <= 3 && (
              <>
                <Spacer size={spacing.md} />
                <Badge
                  label={available === 1 ? "Last piece" : `Only ${available} left`}
                  tone="warning"
                />
              </>
            )}

            {reserved && (
              <>
                <Spacer size={spacing.lg} />
                <View style={styles.reservedNote}>
                  <Ionicons name="time-outline" size={17} color={colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reservedTitle}>Someone is checking out with this piece</Text>
                    <Text style={styles.reservedBody}>
                      We hold a piece for a few minutes while a shopper pays. If they don't finish,
                      it will be available again shortly.
                    </Text>
                  </View>
                </View>
              </>
            )}

            {!!product.description && (
              <>
                <Spacer size={spacing.xl} />
                <Text style={styles.description}>{product.description}</Text>
              </>
            )}

            {(product.material || product.weight_grams) && (
              <>
                <Spacer size={spacing.xl} />
                <GoldRule />
                <Spacer size={spacing.md} />
                {!!product.material && <SpecRow label="Material" value={product.material} />}
                {!!product.weight_grams && (
                  <SpecRow label="Weight" value={`${product.weight_grams} g`} />
                )}
                <SpecRow label="Made" value="Handcrafted in Hyderabad" />
              </>
            )}

            <Spacer size={spacing.xl} />
            <View style={styles.assurance}>
              <AssuranceRow icon="sparkles-outline" text="Handmade in small numbers" />
              <AssuranceRow icon="shield-checkmark-outline" text="Secure payment via Razorpay" />
              <AssuranceRow icon="logo-whatsapp" text="Questions answered on WhatsApp" />
            </View>

            <Spacer size={spacing.lg} />
            <OutlineButton
              title="Ask about this piece"
              icon={<Ionicons name="logo-whatsapp" size={16} color={colors.gold} />}
              onPress={() => openWhatsApp(settings, enquiryMessage(product))}
            />
          </View>

          {/* -------------------------------------------------- Related */}
          {related.length > 0 && (
            <View style={{ width: "100%", paddingTop: spacing.xxl }}>
              <View style={{ paddingHorizontal: spacing.lg }}>
                <SectionTitle>You may also like</SectionTitle>
              </View>
              <FlatList
                horizontal
                data={related}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: spacing.md,
                  padding: spacing.lg,
                }}
                renderItem={({ item }) => (
                  <ProductCard
                    product={item}
                    width={168}
                    onPress={() => router.replace(`/product/${item.id}`)}
                  />
                )}
              />
            </View>
          )}
        </Container>
      </ScrollView>

      {/* --------------------------------------------------- Buy bar */}
      <View style={[styles.buyBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Container width={900} style={{ paddingHorizontal: spacing.lg }}>
          {!!feedback && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{feedback}</Text>
            </View>
          )}

          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <Small style={{ fontSize: 11 }}>
                {inBag > 0 ? `${inBag} in your bag` : reserved ? "Reserved" : "Price"}
              </Small>
              <Text style={styles.buyBarPrice}>{money(product.price)}</Text>
            </View>

            <View style={{ flex: 2 }}>
              {soldOut ? (
                <OutlineButton
                  title="Enquire on WhatsApp"
                  tone="muted"
                  icon={<Ionicons name="logo-whatsapp" size={16} color={colors.textMuted} />}
                  onPress={() =>
                    openWhatsApp(
                      settings,
                      `Hello, is "${product.name}" (${product.code}) available again?`,
                    )
                  }
                />
              ) : reserved && inBag === 0 ? (
                <OutlineButton
                  title="Check again"
                  icon={<Ionicons name="refresh" size={16} color={colors.gold} />}
                  onPress={state.reload}
                />
              ) : inBag > 0 ? (
                <Row gap={spacing.sm}>
                  <OutlineButton
                    title="Add one"
                    size="md"
                    style={{ flex: 1 }}
                    disabled={!canAddMore}
                    onPress={addToBag}
                  />
                  <GoldButton
                    title="View bag"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => router.push("/bag")}
                  />
                </Row>
              ) : (
                <GoldButton
                  title="Add to bag"
                  onPress={addToBag}
                  icon={<Ionicons name="bag-handle-outline" size={16} color={colors.ink} />}
                />
              )}
            </View>
          </Row>
        </Container>
      </View>
    </Screen>
  );
}

function BackBar({ onBack, top }: { onBack: () => void; top: number }) {
  return (
    <View style={[styles.backBar, { paddingTop: top + spacing.sm }]}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.cream} />
      </Pressable>
    </View>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" style={{ paddingVertical: spacing.sm }}>
      <Small>{label}</Small>
      <Text style={styles.specValue}>{value}</Text>
    </Row>
  );
}

function AssuranceRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <Row gap={spacing.md}>
      <Ionicons name={icon} size={15} color={colors.gold} />
      <Text style={styles.assuranceText}>{text}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  backBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
    zIndex: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  galleryFallback: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.gold, width: 18 },

  soldOutBanner: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(8,5,3,0.85)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  soldOutBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },

  category: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
  },
  code: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.4, color: colors.textFaint },
  price: { fontFamily: fonts.bodySemi, fontSize: 27, color: colors.goldLight },
  mrp: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  description: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 23, color: colors.textMuted },
  specValue: { fontFamily: fonts.body, fontSize: 14, color: colors.cream, flexShrink: 1, textAlign: "right" },

  reservedNote: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(212,175,55,0.07)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reservedTitle: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.goldLight },
  reservedBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: 2,
  },

  assurance: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  assuranceText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  buyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSunken,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  buyBarPrice: { fontFamily: fonts.bodySemi, fontSize: 20, color: colors.goldLight },

  toast: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  toastText: { fontFamily: fonts.body, fontSize: 13, color: colors.goldPale, textAlign: "center" },
});
