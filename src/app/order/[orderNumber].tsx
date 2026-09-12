import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
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
import { fetchSettings, lookupOrder } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, money, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/format";
import { openWhatsApp, orderHelpMessage } from "@/lib/contact";

const TIMELINE = ["placed", "confirmed", "packed", "shipped", "delivered"] as const;

export default function OrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderNumber: string; phone?: string; placed?: string }>();
  const justPlaced = params.placed === "1";

  const state = useAsync(async () => {
    const [order, settings] = await Promise.all([
      lookupOrder(params.orderNumber, params.phone ?? ""),
      fetchSettings(),
    ]);
    return { order, settings };
  }, [params.orderNumber, params.phone]);

  if (state.loading) return <Loader label="Fetching your order" />;

  if (state.error || !state.data?.order) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <ErrorNote
            message={
              state.error ??
              "We could not find that order. Please check the order number and the mobile number used."
            }
            onRetry={state.reload}
          />
          <Spacer size={spacing.lg} />
          <OutlineButton title="Back to the shop" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );
  }

  const { order, settings } = state.data;
  const cancelled = order.status === "cancelled";
  const currentStep = TIMELINE.indexOf(order.status as (typeof TIMELINE)[number]);

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxxl }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}>
        <Container width={640} style={{ paddingHorizontal: spacing.xl, alignItems: "center" }}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={cancelled ? "ban-outline" : justPlaced ? "checkmark-circle" : "cube-outline"}
              size={30}
              color={cancelled ? colors.danger : colors.gold}
            />
          </View>

          <Spacer size={spacing.lg} />
          <SectionTitle style={{ textAlign: "center", fontSize: 25 }}>
            {cancelled
              ? "This order was cancelled"
              : justPlaced
                ? "Thank you, your order is placed"
                : "Your order"}
          </SectionTitle>

          {justPlaced && !cancelled && (
            <>
              <Spacer size={spacing.sm} />
              <Small style={{ textAlign: "center", lineHeight: 21 }}>
                We will confirm on WhatsApp shortly. Each piece is handmade, so we pack with care.
              </Small>
            </>
          )}

          <Spacer size={spacing.lg} />
          <Pressable
            onPress={() => Clipboard.setStringAsync(order.order_number)}
            style={({ pressed }) => [styles.orderNumber, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.orderNumberText}>{order.order_number}</Text>
            <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
          </Pressable>
          <Small style={{ fontSize: 11, marginTop: spacing.xs }}>
            Placed on {formatDate(order.created_at)}
          </Small>
        </Container>
      </View>

      <Container width={640} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        {/* --------------------------------------------------- Status */}
        <View style={styles.card}>
          <Row justify="space-between">
            <SectionTitle style={{ fontSize: 18 }}>Status</SectionTitle>
            <Badge
              label={
                order.payment_status === "paid"
                  ? "Paid"
                  : order.payment_method === "cod"
                    ? "Cash on delivery"
                    : PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status
              }
              tone={
                order.payment_status === "paid"
                  ? "emerald"
                  : order.payment_status === "failed"
                    ? "danger"
                    : "warning"
              }
            />
          </Row>

          <Spacer size={spacing.lg} />

          {cancelled ? (
            <Row gap={spacing.md}>
              <Ionicons name="ban-outline" size={17} color={colors.danger} />
              <Text style={[styles.stepLabel, { color: colors.danger }]}>Cancelled</Text>
            </Row>
          ) : (
            <View style={{ gap: 0 }}>
              {TIMELINE.map((step, index) => {
                const done = index <= currentStep;
                const isLast = index === TIMELINE.length - 1;
                return (
                  <View key={step} style={{ flexDirection: "row" }}>
                    <View style={{ alignItems: "center", width: 24 }}>
                      <View style={[styles.stepDot, done && styles.stepDotDone]}>
                        {done && <Ionicons name="checkmark" size={10} color={colors.ink} />}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.stepLine,
                            index < currentStep && { backgroundColor: colors.gold },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        done && { color: colors.cream },
                        index === currentStep && { fontFamily: fonts.bodySemi, color: colors.goldLight },
                      ]}
                    >
                      {ORDER_STATUS_LABEL[step]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {order.payment_status === "pending" && order.payment_method === "razorpay" && (
            <>
              <Spacer size={spacing.lg} />
              <View style={styles.pendingNote}>
                <Text style={styles.pendingNoteText}>
                  We have not received the payment for this order yet. If money was debited it
                  will confirm automatically within a few minutes, or be refunded by your bank.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ---------------------------------------------------- Items */}
        <Spacer size={spacing.lg} />
        <View style={styles.card}>
          <SectionTitle style={{ fontSize: 18 }}>
            {order.items.length === 1 ? "Your piece" : `Your ${order.items.length} pieces`}
          </SectionTitle>
          <Spacer size={spacing.md} />

          {order.items.map((item, index) => (
            <View key={`${item.product_code}-${index}`}>
              {index > 0 && <Divider style={{ marginVertical: spacing.md }} />}
              <Row gap={spacing.md} align="flex-start">
                {item.product_image ? (
                  <Image source={{ uri: item.product_image }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="diamond-outline" size={16} color={colors.goldMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.itemCode}>{item.product_code}</Text>
                  <Small style={{ fontSize: 12, marginTop: 2 }}>
                    {money(item.unit_price)}
                    {item.quantity > 1 ? `  x ${item.quantity}` : ""}
                  </Small>
                </View>
                <Text style={styles.itemTotal}>{money(item.line_total)}</Text>
              </Row>
            </View>
          ))}

          <Divider style={{ marginVertical: spacing.lg }} />
          <TotalRow label="Subtotal" value={money(order.subtotal)} />
          <TotalRow
            label="Delivery"
            value={Number(order.delivery_charge) === 0 ? "Free" : money(order.delivery_charge)}
          />
          <Divider style={{ marginVertical: spacing.md }} />
          <TotalRow label="Total" value={money(order.total)} emphasis />
        </View>

        {/* -------------------------------------------------- Support */}
        <Spacer size={spacing.lg} />
        <GoldButton
          title="Get help on WhatsApp"
          icon={<Ionicons name="logo-whatsapp" size={16} color={colors.ink} />}
          onPress={() => openWhatsApp(settings, orderHelpMessage(order.order_number))}
        />
        <Spacer size={spacing.md} />
        <OutlineButton
          title="Continue shopping"
          tone="muted"
          onPress={() => router.replace("/shop")}
        />

        <Spacer size={spacing.xxl} />
        <GoldRule />
        <Spacer size={spacing.md} />
        <Small style={{ textAlign: "center", fontSize: 11.5 }}>
          Keep your order number handy. You can look this up any time from More {"→"} Track your order.
        </Small>
      </Container>
    </Screen>
  );
}

function TotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Row justify="space-between" style={{ paddingVertical: 3 }}>
      <Text style={[styles.totalLabel, emphasis && styles.totalLabelStrong]}>{label}</Text>
      <Text style={[styles.totalValue, emphasis && styles.totalValueStrong]}>{value}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  orderNumber: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  orderNumberText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.goldLight, letterSpacing: 0.5 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepLine: { width: 1, flex: 1, minHeight: 22, backgroundColor: colors.border },
  stepLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textFaint,
    marginLeft: spacing.md,
    paddingBottom: spacing.lg,
  },

  pendingNote: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(224,169,63,0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pendingNoteText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.warning },

  thumb: { width: 54, height: 62, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: fonts.body, fontSize: 14, color: colors.cream, lineHeight: 19 },
  itemCode: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1, color: colors.textFaint },
  itemTotal: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.cream },

  totalLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  totalLabelStrong: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream },
  totalValue: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  totalValueStrong: { fontFamily: fonts.bodySemi, fontSize: 19, color: colors.goldLight },
});
