import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, spacing } from "@/theme";
import {
  Container,
  GoldButton,
  Loader,
  OutlineButton,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import {
  RazorpayCheckout,
  type RazorpayOptions,
  type RazorpaySuccess,
} from "@/components/RazorpayCheckout";
import { verifyPayment } from "@/lib/api";
import { money } from "@/lib/format";
import { useCart } from "@/store/cart";

/**
 * paying      Razorpay Checkout is open
 * verifying   Razorpay said yes; confirming with our server
 * cancelled   the shopper closed Checkout -- nothing was charged
 * failed      Razorpay reported the payment did not go through
 * unconfirmed Razorpay said yes but our confirmation call failed.
 *             Money has probably moved, so never offer to pay again.
 * expired     the hold on the pieces has run out
 */
type Phase = "paying" | "verifying" | "cancelled" | "failed" | "unconfirmed" | "expired";

/**
 * Checkout closes this long before the hold lapses, so a payment cannot
 * complete for pieces that have just been released to someone else.
 */
const SAFETY_MARGIN_MS = 60_000;

export default function PayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearCart = useCart((s) => s.clear);

  const params = useLocalSearchParams<{
    orderNumber: string;
    rzpOrderId: string;
    keyId: string;
    amount: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
    holdSeconds?: string;
    placedAt?: string;
  }>();

  const amountPaise = Number(params.amount ?? 0);
  const holdSeconds = Number(params.holdSeconds ?? 0);
  const holdMinutes = Math.round(holdSeconds / 60);
  const holdExpiresAt =
    holdSeconds > 0 ? Number(params.placedAt ?? Date.now()) + holdSeconds * 1000 : null;

  const holdLapsed = (at: number) =>
    holdExpiresAt !== null && at >= holdExpiresAt - SAFETY_MARGIN_MS;

  // Reopening this screen from a stale link (web reload, history) must not
  // start a payment for pieces that are no longer held.
  const [phase, setPhase] = useState<Phase>(() => (holdLapsed(Date.now()) ? "expired" : "paying"));
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // A ticking clock for the "held for N more minutes" line. It must not
  // run while Checkout is open: re-rendering would rebuild the Checkout
  // page underneath a shopper who is part-way through paying.
  useEffect(() => {
    if (phase === "paying" || phase === "verifying") return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [phase]);

  // Built once per attempt, for the same reason.
  const options = useMemo<RazorpayOptions>(() => {
    const secondsLeft = holdExpiresAt
      ? Math.floor((holdExpiresAt - SAFETY_MARGIN_MS - Date.now()) / 1000)
      : null;

    return {
      key: params.keyId,
      amount: amountPaise,
      currency: "INR",
      name: "San Signature Jewels",
      description: `Order ${params.orderNumber}`,
      order_id: params.rzpOrderId,
      prefill: {
        name: params.name ?? "",
        contact: params.contact ?? "",
        email: params.email ?? "",
      },
      theme: { color: colors.gold, backdrop_color: colors.ink },
      ...(secondsLeft !== null ? { timeout: Math.max(60, secondsLeft) } : null),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  async function handleSuccess(result: RazorpaySuccess) {
    setPhase("verifying");
    try {
      await verifyPayment({
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      clearCart();
      router.replace(
        `/order/${encodeURIComponent(params.orderNumber)}?phone=${encodeURIComponent(params.phone ?? "")}&placed=1`,
      );
    } catch {
      // The money has very likely left the shopper's account. The webhook
      // will still settle the order, so say that -- and do not offer a
      // second payment.
      setPhase("unconfirmed");
      setMessage(null);
    }
  }

  function retry() {
    if (holdLapsed(Date.now())) {
      setPhase("expired");
      return;
    }
    setMessage(null);
    setAttempt((n) => n + 1);
    setPhase("paying");
  }

  const goToOrder = () =>
    router.replace(
      `/order/${encodeURIComponent(params.orderNumber)}?phone=${encodeURIComponent(params.phone ?? "")}`,
    );

  // Arriving at the bag releases this device's holds (see bag.tsx), so
  // giving up frees the pieces for other shoppers straight away.
  const backToBag = () => router.replace("/bag");

  if (phase === "verifying") {
    return <Loader label="Confirming your payment" />;
  }

  if (phase === "paying") {
    return (
      <Screen>
        <RazorpayCheckout
          key={attempt}
          options={options}
          onSuccess={handleSuccess}
          onDismiss={() => {
            setMessage(null);
            setPhase(holdLapsed(Date.now()) ? "expired" : "cancelled");
          }}
          onFailure={(text) => {
            setMessage(text);
            setPhase(holdLapsed(Date.now()) ? "expired" : "failed");
          }}
        />
      </Screen>
    );
  }

  // Sitting on the cancelled or failed screen past the hold turns it into
  // the expired screen, rather than offering a retry that cannot work.
  const view: Phase = (phase === "cancelled" || phase === "failed") && holdLapsed(now) ? "expired" : phase;

  const minutesLeft = holdExpiresAt
    ? Math.max(1, Math.ceil((holdExpiresAt - SAFETY_MARGIN_MS - now) / 60_000))
    : null;

  const copy = {
    cancelled: {
      icon: "time-outline" as const,
      tone: colors.gold,
      title: "Payment not completed",
      body: "Your order is saved and nothing has been charged.",
    },
    failed: {
      icon: "alert-circle-outline" as const,
      tone: colors.danger,
      title: "The payment didn't go through",
      body: message ?? "Please try again, or choose a different payment method.",
    },
    unconfirmed: {
      icon: "hourglass-outline" as const,
      tone: colors.gold,
      title: "We're confirming your payment",
      body: "Razorpay told us your payment went through, but we couldn't confirm it with the shop just now. There is no need to pay again - your order will update automatically within a few minutes.",
    },
    expired: {
      icon: "time-outline" as const,
      tone: colors.gold,
      title: "Your hold on these pieces has ended",
      body: `We set pieces aside for ${holdMinutes || 15} minutes while you pay, so nobody else can buy them first. That time has run out and they have been released. Your bag is still saved - check out again and we'll hold them for you afresh.`,
    },
  }[view as "cancelled" | "failed" | "unconfirmed" | "expired"];

  return (
    <Screen>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.xxxl }]}>
        <Container width={520} style={{ paddingHorizontal: spacing.xl, alignItems: "center" }}>
          <View style={[styles.icon, { borderColor: copy.tone }]}>
            <Ionicons name={copy.icon} size={28} color={copy.tone} />
          </View>

          <Spacer size={spacing.lg} />
          <SectionTitle style={{ textAlign: "center" }}>{copy.title}</SectionTitle>

          <Spacer size={spacing.md} />
          <Small style={{ textAlign: "center", lineHeight: 21 }}>{copy.body}</Small>

          {(view === "cancelled" || view === "failed") && minutesLeft !== null && (
            <>
              <Spacer size={spacing.md} />
              <Text style={styles.holdLine}>
                Your pieces are held for about {minutesLeft} more minute{minutesLeft === 1 ? "" : "s"}.
              </Text>
            </>
          )}

          <Spacer size={spacing.lg} />
          <View style={styles.orderChip}>
            <Text style={styles.orderChipLabel}>Order</Text>
            <Text style={styles.orderChipValue}>{params.orderNumber}</Text>
            <Text style={styles.orderChipLabel}>{money(amountPaise / 100)}</Text>
          </View>

          <Spacer size={spacing.xxl} />

          {view === "cancelled" || view === "failed" ? (
            <>
              <GoldButton
                title="Try payment again"
                onPress={retry}
                icon={<Ionicons name="refresh" size={16} color={colors.ink} />}
              />
              <Spacer size={spacing.md} />
              <OutlineButton title="Back to my bag" tone="muted" onPress={backToBag} />
            </>
          ) : view === "unconfirmed" ? (
            <GoldButton title="Check my order" onPress={goToOrder} />
          ) : (
            <>
              <GoldButton title="Back to my bag" onPress={backToBag} />
              <Spacer size={spacing.md} />
              <OutlineButton title="Check this order's status" tone="muted" onPress={goToOrder} />
            </>
          )}

          <Spacer size={spacing.xl} />
          <Small style={{ textAlign: "center", fontSize: 11.5 }}>
            If money has been debited, it will either be confirmed against this order
            automatically or refunded by your bank within 5-7 working days.
          </Small>
        </Container>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  holdLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.goldLight,
    textAlign: "center",
  },
  orderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  orderChipLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  orderChipValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.goldLight },
});
