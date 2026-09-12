import { Platform } from "react-native";

/**
 * Brand tokens taken from the San Signature Jewels visiting card:
 * a near-black ground, warm antique gold, and the emerald of the
 * pendant used sparingly as the single accent.
 *
 * The store is deliberately dark-only. Gold on black is the identity;
 * a light variant would read as a different brand.
 */

export const colors = {
  // Grounds
  ink: "#0B0705",
  surface: "#16100A",
  surfaceRaised: "#1F160D",
  surfaceSunken: "#080504",

  // Gold ramp
  gold: "#D4AF37",
  goldLight: "#F3DFA2",
  goldPale: "#FBF2D8",
  goldDeep: "#A67C1A",
  goldMuted: "#7A5C16",

  // Type
  cream: "#F6EFE2",
  text: "#F6EFE2",
  textMuted: "#A8987E",
  textFaint: "#6E6250",

  // Lines
  border: "#332413",
  borderStrong: "#4A3518",

  // Accents
  emerald: "#1F6F52",
  emeraldLight: "#39A178",
  danger: "#E0614E",
  success: "#4BAF7E",
  warning: "#E0A93F",

  overlay: "rgba(6, 4, 2, 0.82)",
} as const;

/** Used by expo-linear-gradient for the card's brushed-gold look. */
export const gradients = {
  gold: ["#F3DFA2", "#D4AF37", "#A67C1A"] as const,
  goldSoft: ["#D4AF37", "#A67C1A"] as const,
  fadeUp: ["transparent", "rgba(8, 5, 3, 0.55)", "rgba(8, 5, 3, 0.96)"] as const,
  sheen: ["rgba(243, 223, 162, 0.16)", "rgba(243, 223, 162, 0)"] as const,
};

export const fonts = {
  /** Cormorant Garamond -- the high-contrast serif of the wordmark. */
  display: "CormorantGaramond_600SemiBold",
  displayRegular: "CormorantGaramond_400Regular",
  /** The card's script tagline. */
  script: "CormorantGaramond_500Medium_Italic",
  /** Jost -- geometric sans for everything functional. */
  body: "Jost_400Regular",
  bodyMedium: "Jost_500Medium",
  bodySemi: "Jost_600SemiBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 42, lineHeight: 48, color: colors.goldLight },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.cream },
  section: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.cream,
  },
  script: { fontFamily: fonts.script, fontSize: 18, color: colors.gold },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  tiny: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMuted },
  price: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.goldLight },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: colors.textMuted,
  },
  button: { fontFamily: fonts.bodySemi, fontSize: 15, letterSpacing: 0.6 },
} as const;

/**
 * React Native Web deprecated the `shadow*` props in favour of CSS
 * `boxShadow`, so each platform gets the form it actually wants rather
 * than a console warning on every render.
 */
export const shadow = {
  card: Platform.select({
    web: { boxShadow: "0 6px 14px rgba(0, 0, 0, 0.45)" },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  }) as object,

  raised: Platform.select({
    web: { boxShadow: "0 10px 22px rgba(0, 0, 0, 0.6)" },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.6,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
  }) as object,
};

/** Widest content column on desktop web; phones just fill the screen. */
export const MAX_CONTENT_WIDTH = 1180;
