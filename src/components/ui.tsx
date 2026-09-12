import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, radius, shadow, spacing, type, MAX_CONTENT_WIDTH } from "@/theme";

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

export function Screen({
  children,
  style,
  scroll = false,
  contentStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
}) {
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Centres and caps content width so the site does not sprawl on desktop. */
export function Container({
  children,
  style,
  width = MAX_CONTENT_WIDTH,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  return (
    <View style={[{ width: "100%", maxWidth: width, alignSelf: "center" }, style]}>
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
  gap = spacing.sm,
  align = "center",
  justify = "flex-start",
  wrap = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: align,
          justifyContent: justify,
          gap,
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/** A hairline with a gold diamond, echoing the dividers on the card. */
export function GoldRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.ruleWrap, style]}>
      <View style={styles.ruleLine} />
      <View style={styles.ruleDiamond} />
      <View style={styles.ruleLine} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

// ---------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------

type TextProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export const Title = ({ children, style, numberOfLines }: TextProps) => (
  <Text style={[type.title, style]} numberOfLines={numberOfLines}>{children}</Text>
);

export const SectionTitle = ({ children, style, numberOfLines }: TextProps) => (
  <Text style={[type.section, style]} numberOfLines={numberOfLines}>{children}</Text>
);

export const Body = ({ children, style, numberOfLines }: TextProps) => (
  <Text style={[type.body, style]} numberOfLines={numberOfLines}>{children}</Text>
);

export const Small = ({ children, style, numberOfLines }: TextProps) => (
  <Text style={[type.small, style]} numberOfLines={numberOfLines}>{children}</Text>
);

export const Label = ({ children, style }: TextProps) => (
  <Text style={[type.label, style]}>{children}</Text>
);

export const Script = ({ children, style }: TextProps) => (
  <Text style={[type.script, style]}>{children}</Text>
);

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md" | "lg";
  full?: boolean;
};

function tap() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

const HEIGHTS = { sm: 38, md: 48, lg: 56 } as const;

export function GoldButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
  style,
  size = "md",
  full = true,
}: ButtonProps) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        if (off) return;
        tap();
        onPress?.();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        { opacity: off ? 0.45 : pressed ? 0.85 : 1, width: full ? "100%" : undefined },
        style,
      ]}
    >
      <LinearGradient
        colors={gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, { height: HEIGHTS[size] }]}
      >
        {loading ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Row gap={spacing.sm}>
            {icon}
            <Text style={[type.button, { color: colors.ink }]}>{title}</Text>
          </Row>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function OutlineButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
  style,
  size = "md",
  full = true,
  tone = "gold",
}: ButtonProps & { tone?: "gold" | "danger" | "muted" }) {
  const off = disabled || loading;
  const tint =
    tone === "danger" ? colors.danger : tone === "muted" ? colors.textMuted : colors.gold;

  return (
    <Pressable
      onPress={() => {
        if (off) return;
        tap();
        onPress?.();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        styles.outlineButton,
        {
          height: HEIGHTS[size],
          borderColor: tint,
          opacity: off ? 0.4 : pressed ? 0.7 : 1,
          width: full ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <Row gap={spacing.sm}>
          {icon}
          <Text style={[type.button, { color: tint }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function TextButton({
  title,
  onPress,
  style,
  tone = "gold",
}: {
  title: string;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
  tone?: "gold" | "muted" | "danger";
}) {
  const tint =
    tone === "danger" ? colors.danger : tone === "muted" ? colors.textMuted : colors.gold;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      {({ pressed }) => (
        <Text
          style={[
            { fontFamily: type.button.fontFamily, fontSize: 14, color: tint },
            pressed && { opacity: 0.6 },
            style,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------

export function Field({
  label,
  error,
  hint,
  required,
  containerStyle,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {!!label && (
        <Label>
          {label}
          {required ? " *" : ""}
        </Label>
      )}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && { borderColor: colors.gold },
          !!error && { borderColor: colors.danger },
          inputProps.multiline && { height: undefined, minHeight: 96, paddingTop: spacing.md },
          inputProps.style,
        ]}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Small style={{ fontSize: 12 }}>{hint}</Small>}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text
        style={[
          { fontFamily: type.body.fontFamily, fontSize: 13 },
          { color: selected ? colors.ink : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "gold",
  style,
}: {
  label: string;
  tone?: "gold" | "emerald" | "danger" | "muted" | "warning";
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    gold: { bg: "rgba(212,175,55,0.16)", fg: colors.goldLight },
    emerald: { bg: "rgba(31,111,82,0.22)", fg: colors.emeraldLight },
    danger: { bg: "rgba(224,97,78,0.18)", fg: colors.danger },
    warning: { bg: "rgba(224,169,63,0.18)", fg: colors.warning },
    muted: { bg: "rgba(168,152,126,0.14)", fg: colors.textMuted },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------------------------------------------------------------------
// States
// ---------------------------------------------------------------------

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.gold} size="large" />
      {!!label && <Small style={{ marginTop: spacing.md }}>{label}</Small>}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyDiamond} />
      <SectionTitle style={{ textAlign: "center", marginTop: spacing.lg }}>{title}</SectionTitle>
      {!!message && (
        <Small style={{ textAlign: "center", marginTop: spacing.sm, maxWidth: 320 }}>
          {message}
        </Small>
      )}
      {!!action && <View style={{ marginTop: spacing.xl, minWidth: 200 }}>{action}</View>}
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorNote}>
      <Text style={[type.small, { color: colors.danger, flex: 1 }]}>{message}</Text>
      {!!onRetry && <TextButton title="Retry" onPress={onRetry} />}
    </View>
  );
}

export function InfoNote({ message, tone = "gold" }: { message: string; tone?: "gold" | "emerald" }) {
  return (
    <View
      style={[
        styles.infoNote,
        tone === "emerald" && {
          borderColor: colors.emerald,
          backgroundColor: "rgba(31,111,82,0.12)",
        },
      ]}
    >
      <Text style={[type.small, { color: tone === "emerald" ? colors.emeraldLight : colors.goldLight }]}>
        {message}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------
// Responsive helper
// ---------------------------------------------------------------------

/** Column count for the product grid, from phone through desktop. */
export function useGridColumns(): { columns: number; isWide: boolean; width: number } {
  const { width } = useWindowDimensions();
  const columns = width >= 1280 ? 5 : width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  return { columns, isWide: width >= 700, width };
}

// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },

  button: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  outlineButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: 15,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : null),
  },
  errorText: {
    fontFamily: type.small.fontFamily,
    fontSize: 12,
    color: colors.danger,
  },

  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontFamily: type.label.fontFamily,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },

  divider: { height: 1, backgroundColor: colors.border },

  ruleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: colors.border },
  ruleDiamond: {
    width: 7,
    height: 7,
    backgroundColor: colors.gold,
    transform: [{ rotate: "45deg" }],
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 280,
  },
  emptyDiamond: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    transform: [{ rotate: "45deg" }],
  },

  errorNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(224,97,78,0.10)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoNote: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
