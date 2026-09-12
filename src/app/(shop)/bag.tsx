import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Container,
  Divider,
  EmptyState,
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
import { money } from "@/lib/format";
import { fetchSettings, refreshCartLines, releaseHolds } from "@/lib/api";
import { cartSavings, cartSubtotal, useCart } from "@/store/cart";
import { useAsync } from "@/lib/useAsync";
import type { CartLine } from "@/lib/types";

export default function BagScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const replaceAll = useCart((s) => s.replaceAll);

  const settings = useAsync(fetchSettings, []);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Prices and stock move while a bag sits unopened. Re-check against
  // the live catalogue every time the screen is shown, and say plainly
  // what changed rather than silently swapping the numbers.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      // Read the bag as it is now. This tab stays mounted, so a value
      // captured when the callback was created would be the bag from the
      // first visit -- and pieces added since would be wiped on return.
      const checked = useCart.getState().lines;
      if (!hydrated || checked.length === 0) return;

      (async () => {
        setSyncing(true);
        try {
          // Being on the bag means not paying. Let go of anything this
          // device was holding from an unfinished payment first -- both so
          // other shoppers can buy it, and so our own hold does not make
          // our own pieces look reserved in the check below.
          await releaseHolds();
          const fresh = await refreshCartLines(checked);
          if (cancelled) return;

          // Merge into the bag as it is *after* the check: the shopper may
          // have changed a quantity or added a piece while it ran.
          const freshById = new Map(fresh.map((f) => [f.productId, f]));
          const gone = new Set(
            checked.filter((c) => !freshById.has(c.productId)).map((c) => c.productId),
          );
          const merged = useCart.getState().lines.flatMap((current) => {
            if (gone.has(current.productId)) return [];
            const update = freshById.get(current.productId);
            if (!update) return [current]; // added mid-check; verified next visit
            return [
              { ...update, quantity: Math.min(current.quantity, Math.max(update.stock, 0)) },
            ];
          });

          replaceAll(merged);
          setNotice(describeChanges(checked, fresh));
        } catch {
          // Offline: leave the saved bag exactly as it is.
        } finally {
          if (!cancelled) setSyncing(false);
        }
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated]),
  );

  if (!hydrated) return <Loader />;

  const subtotal = cartSubtotal(lines);
  const savings = cartSavings(lines);
  const deliveryCharge =
    settings.data && settings.data.free_delivery_above > 0 && subtotal >= settings.data.free_delivery_above
      ? 0
      : Number(settings.data?.delivery_charge ?? 0);
  const total = subtotal + deliveryCharge;
  const hasSoldOut = lines.some((l) => l.stock <= 0);
  const awayFromFree = settings.data ? settings.data.free_delivery_above - subtotal : 0;

  if (lines.length === 0) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Container style={{ paddingHorizontal: spacing.lg }}>
            <Text style={styles.title}>Your Bag</Text>
          </Container>
        </View>
        <EmptyState
          title="Your bag is empty"
          message="Every piece is handmade in small numbers, so the ones you love are worth keeping."
          action={<GoldButton title="Browse the collection" onPress={() => router.push("/shop")} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Row justify="space-between">
            <Text style={styles.title}>Your Bag</Text>
            {syncing && <Small>Checking availability...</Small>}
          </Row>
        </Container>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        <Container style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {!!notice && (
            <>
              <InfoNote message={notice} />
              <Spacer size={spacing.lg} />
            </>
          )}

          <View style={{ gap: spacing.md }}>
            {lines.map((line) => (
              <BagRow
                key={line.productId}
                line={line}
                onOpen={() => router.push(`/product/${line.productId}`)}
                onQuantity={(q) => setQuantity(line.productId, q)}
                onRemove={() => remove(line.productId)}
              />
            ))}
          </View>

          <Spacer size={spacing.xl} />

          {awayFromFree > 0 && Number(settings.data?.delivery_charge) > 0 && (
            <>
              <InfoNote message={`Add ${money(awayFromFree)} more for free delivery.`} />
              <Spacer size={spacing.lg} />
            </>
          )}

          <View style={styles.summary}>
            <SummaryRow label="Subtotal" value={money(subtotal)} />
            {savings > 0 && (
              <SummaryRow label="You save" value={`- ${money(savings)}`} tone="emerald" />
            )}
            <SummaryRow
              label="Delivery"
              value={deliveryCharge === 0 ? "Free" : money(deliveryCharge)}
              tone={deliveryCharge === 0 ? "emerald" : undefined}
            />
            <Divider style={{ marginVertical: spacing.md }} />
            <SummaryRow label="Total" value={money(total)} emphasis />
          </View>
        </Container>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Row justify="space-between" style={{ marginBottom: spacing.md }}>
            <View>
              <Small>Total payable</Small>
              <Text style={styles.footerTotal}>{money(total)}</Text>
            </View>
            <TextButton title="Continue shopping" onPress={() => router.push("/shop")} />
          </Row>
          <GoldButton
            title={hasSoldOut ? "Remove sold-out pieces to continue" : "Proceed to checkout"}
            onPress={() => router.push("/checkout")}
            disabled={hasSoldOut}
            icon={<Ionicons name="arrow-forward" size={16} color={colors.ink} />}
          />
        </Container>
      </View>
    </Screen>
  );
}

function BagRow({
  line,
  onOpen,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  onOpen: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const soldOut = line.stock <= 0;
  const reserved = !soldOut && line.available !== undefined && line.available < line.quantity;

  return (
    <View style={[styles.row, soldOut && { opacity: 0.55 }]}>
      <Pressable onPress={onOpen}>
        {line.image ? (
          <Image source={{ uri: line.image }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="diamond-outline" size={18} color={colors.goldMuted} />
          </View>
        )}
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <Pressable onPress={onOpen}>
          <Text style={styles.rowName} numberOfLines={2}>
            {line.name}
          </Text>
        </Pressable>
        <Text style={styles.rowCode}>{line.code}</Text>

        <Row gap={spacing.sm} style={{ marginTop: 2 }}>
          <Text style={styles.rowPrice}>{money(line.price)}</Text>
          {!!line.mrp && line.mrp > line.price && (
            <Text style={styles.rowMrp}>{money(line.mrp)}</Text>
          )}
        </Row>

        {soldOut ? (
          <Text style={styles.soldOut}>Sold out - please remove to continue</Text>
        ) : (
          <Row justify="space-between" style={{ marginTop: spacing.sm }}>
            <Stepper
              value={line.quantity}
              max={line.stock}
              onChange={onQuantity}
            />
            <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove from bag">
              <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
            </Pressable>
          </Row>
        )}

        {reserved && (
          <Small style={{ color: colors.goldLight, fontSize: 11, marginTop: 2 }}>
            {line.available === 0
              ? "Reserved right now - another shopper is paying"
              : `Only ${line.available} free right now - another shopper is paying`}
          </Small>
        )}

        {!soldOut && !reserved && line.stock <= 2 && (
          <Small style={{ color: colors.warning, fontSize: 11, marginTop: 2 }}>
            {line.stock === 1 ? "Last piece available" : `Only ${line.stock} left`}
          </Small>
        )}
      </View>
    </View>
  );
}

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(value - 1)}
        style={styles.stepperButton}
        accessibilityLabel="Decrease quantity"
      >
        <Ionicons name="remove" size={15} color={colors.gold} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={() => value < max && onChange(value + 1)}
        style={[styles.stepperButton, value >= max && { opacity: 0.3 }]}
        disabled={value >= max}
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={15} color={colors.gold} />
      </Pressable>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "emerald";
}) {
  return (
    <Row justify="space-between" style={{ paddingVertical: 3 }}>
      <Text style={[styles.summaryLabel, emphasis && styles.summaryLabelStrong]}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          emphasis && styles.summaryValueStrong,
          tone === "emerald" && { color: colors.emeraldLight },
        ]}
      >
        {value}
      </Text>
    </Row>
  );
}

/** A short, honest note about anything that moved since the bag was filled. */
function describeChanges(before: CartLine[], after: CartLine[]): string | null {
  const removed = before.filter((b) => !after.some((a) => a.productId === b.productId));
  const repriced = after.filter((a) => {
    const b = before.find((x) => x.productId === a.productId);
    return b && b.price !== a.price;
  });
  const reduced = after.filter((a) => {
    const b = before.find((x) => x.productId === a.productId);
    return b && a.quantity < b.quantity;
  });

  const parts: string[] = [];
  if (removed.length) {
    parts.push(
      removed.length === 1
        ? `"${removed[0].name}" is no longer available and was removed.`
        : `${removed.length} pieces are no longer available and were removed.`,
    );
  }
  if (repriced.length) {
    parts.push(
      repriced.length === 1
        ? `The price of "${repriced[0].name}" has changed to ${money(repriced[0].price)}.`
        : `Prices were updated on ${repriced.length} pieces.`,
    );
  }
  if (reduced.length) {
    parts.push("Quantities were reduced to match what is left in stock.");
  }

  // Not a change to the bag -- a heads-up. Held pieces stay put, because
  // the other shopper's hold may lapse in a few minutes.
  const held = after.filter(
    (a) => a.stock > 0 && a.available !== undefined && a.available < a.quantity,
  );
  if (held.length) {
    parts.push(
      held.length === 1
        ? `Another shopper is paying for "${held[0].name}" right now. It stays in your bag, and you can check out if they don't finish in the next few minutes.`
        : `Other shoppers are paying for ${held.length} of your pieces right now. They stay in your bag in case those purchases aren't completed.`,
    );
  }
  return parts.length ? parts.join(" ") : null;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.goldLight },

  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: { width: 82, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  thumbFallback: { alignItems: "center", justifyContent: "center" },

  rowName: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.cream },
  rowCode: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1, color: colors.textFaint },
  rowPrice: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.goldLight },
  rowMrp: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  soldOut: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: spacing.sm },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  stepperButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  stepperValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.cream,
    minWidth: 22,
    textAlign: "center",
  },

  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  summaryLabelStrong: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 },
  summaryValue: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  summaryValueStrong: { fontFamily: fonts.bodySemi, fontSize: 19, color: colors.goldLight },

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
  footerTotal: { fontFamily: fonts.bodySemi, fontSize: 21, color: colors.goldLight },
});
