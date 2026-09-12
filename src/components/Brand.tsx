import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, gradients, spacing } from "@/theme";

/**
 * The SJ monogram from the visiting card, rebuilt with layout primitives
 * rather than an image so it stays crisp at any size and needs no asset
 * round-trip. A gold ring, the serif monogram, and the small crown that
 * sits above it on the card.
 */
export function Monogram({
  size = 56,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = size;
  const crown = size * 0.16;

  return (
    <View style={[{ alignItems: "center" }, style]}>
      {/* crown: three points, as on the card */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: size * 0.05 }}>
        <View style={[dot(crown * 0.42)]} />
        <View style={[dot(crown * 0.58)]} />
        <View style={[dot(crown * 0.42)]} />
      </View>

      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: Math.max(1, size * 0.028),
          borderColor: colors.gold,
          alignItems: "center",
          justifyContent: "center",
          marginTop: size * 0.04,
        }}
      >
        <View
          style={{
            width: ring * 0.84,
            height: ring * 0.84,
            borderRadius: (ring * 0.84) / 2,
            borderWidth: 1,
            borderColor: colors.goldMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: size * 0.44,
              color: colors.goldLight,
              letterSpacing: -size * 0.02,
              includeFontPadding: false,
            }}
          >
            SJ
          </Text>
        </View>
      </View>
    </View>
  );
}

const dot = (s: number): ViewStyle => ({
  width: Math.max(2, s * 0.5),
  height: Math.max(2, s),
  backgroundColor: colors.gold,
  borderRadius: 1,
});

/** Full stacked wordmark: San / Signature Jewels / tagline. */
export function Wordmark({
  size = "md",
  tagline,
  style,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = size === "lg" ? 1 : size === "md" ? 0.72 : 0.5;

  return (
    <View style={[{ alignItems: "center" }, style]}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 64 * scale,
          lineHeight: 70 * scale,
          color: colors.goldLight,
          includeFontPadding: false,
        }}
      >
        San
      </Text>
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 20 * scale,
          letterSpacing: 3 * scale,
          color: colors.gold,
          marginTop: 2 * scale,
          textTransform: "uppercase",
        }}
      >
        Signature Jewels
      </Text>
      {tagline !== null && (
        <>
          <View style={[brandStyles.hair, { width: 120 * scale, marginVertical: 10 * scale }]} />
          <Text
            style={{
              fontFamily: fonts.script,
              fontSize: 20 * scale,
              color: colors.gold,
            }}
          >
            {tagline ?? "Elegance Crafted for You"}
          </Text>
        </>
      )}
    </View>
  );
}

/** Compact horizontal lockup for headers and the web nav bar. */
export function BrandBar({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: spacing.md }, style]}>
      <Monogram size={34} />
      <View>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 22,
            lineHeight: 24,
            color: colors.goldLight,
            includeFontPadding: false,
          }}
        >
          San
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 9,
            letterSpacing: 2.4,
            color: colors.gold,
            textTransform: "uppercase",
          }}
        >
          Signature Jewels
        </Text>
      </View>
    </View>
  );
}

/** The brushed-gold brush-stroke panel from the bottom-left of the card. */
export function GoldPlaque({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={gradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[brandStyles.plaque, style]}
    >
      {children}
    </LinearGradient>
  );
}

const brandStyles = StyleSheet.create({
  hair: { height: 1, backgroundColor: colors.goldMuted },
  plaque: {
    borderRadius: 4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
