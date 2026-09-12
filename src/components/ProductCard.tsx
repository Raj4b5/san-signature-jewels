import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, gradients, radius, spacing } from "@/theme";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  onPress,
  width,
}: {
  product: Product;
  onPress: () => void;
  width?: number;
}) {
  const soldOut = product.stock <= 0;
  const hasDiscount = product.discount_percent > 0 && !!product.mrp;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${money(product.price)}${soldOut ? ", sold out" : ""}`}
      style={({ pressed }) => [styles.card, !!width && { width }, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.imageWrap}>
        {product.images?.[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={styles.image}
            contentFit="cover"
            transition={220}
            // The card already sits on the dark ground, so the image can
            // simply fade in over it -- no placeholder asset needed.
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <View style={styles.fallbackDiamond} />
          </View>
        )}

        {/* Gentle darkening so white price text always holds up. */}
        <LinearGradient colors={gradients.fadeUp} style={styles.imageScrim} pointerEvents="none" />

        {hasDiscount && !soldOut && (
          <View style={styles.discountTag}>
            <Text style={styles.discountText}>{product.discount_percent}% OFF</Text>
          </View>
        )}

        {soldOut && (
          <View style={styles.soldOutVeil}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        )}

        {!soldOut && product.stock <= 2 && (
          <View style={styles.lowStock}>
            <Text style={styles.lowStockText}>
              {product.stock === 1 ? "Last piece" : `Only ${product.stock} left`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.code}>{product.code}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(product.price)}</Text>
          {hasDiscount && <Text style={styles.mrp}>{money(product.mrp!)}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageWrap: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.surfaceSunken },
  image: { width: "100%", height: "100%" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  fallbackDiamond: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    transform: [{ rotate: "45deg" }],
  },
  imageScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "38%" },

  discountTag: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.emerald,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  discountText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.goldPale,
  },

  lowStock: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(11,7,5,0.78)",
    borderWidth: 1,
    borderColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  lowStockText: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.goldLight,
  },

  soldOutVeil: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(8,5,3,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textMuted,
  },

  body: { padding: spacing.md, gap: 2 },
  name: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.cream,
    minHeight: 36,
  },
  code: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1, color: colors.textFaint },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 4 },
  price: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.goldLight },
  mrp: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
});
