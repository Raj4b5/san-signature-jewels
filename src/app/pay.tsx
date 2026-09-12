import React, { useState } from "react";
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
import { RazorpayCheckout, type RazorpaySuccess } from "@/components/RazorpayCheckout";
import { verifyPayment } from "@/lib/api";
import { money } from "@/lib/format";
import { useCart } from "@/store/cart";

type Phase = "paying" | "verifying" | "cancelled" | "failed";

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
  }>();

  const [phase, setPhase] = useState<Phase>("paying");
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const amountPaise = Number(params.amount ?? 0);

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
    } catch (e) {
      // The money may well have left the customer's account, so never
      // say "payment failed" here -- the webhook still settles it.
      setPhase("failed");
      setMessage(
        e instanceof Error
          ? e.message
          : "Your payment went through but we could not confirm it instantly.",
      );
    }
  }

  if (phase === "verifying") {
    return <Loader label="Confirming your payment" />;
  }

  if (phase === "paying") {
    return (
      <Screen>
        <RazorpayCheckout
          key={attempt}
          options={{
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
          }}
          onSuccess={handleSuccess}
          onDismiss={() => {
            setPhase("cancelled");
            setMessage(null);
          }}
          onFailure={(text) => {
            setPhase("failed");
            setMessage(text);
          }}
        />
      </Screen>
    );
  }

  const cancelled = phase === "cancelled";

  return (
    <Screen>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.xxxl }]}>
        <Container width={520} style={{ paddingHorizontal: spacing.xl, alignItems: "center" }}>
          <View style={[styles.icon, !cancelled && { borderColor: colors.danger }]}>
            <Ionicons
              name={cancelled ? "time-outline" : "alert-circle-outline"}
              size={28}
              color={cancelled ? colors.gold : colors.danger}
            />
          </View>

          <Spacer size={spacing.lg} />
          <SectionTitle style={{ textAlign: "center" }}>
            {cancelled ? "Payment not completed" : "Something interrupted the payment"}
          </SectionTitle>

          <Spacer size={spacing.md} />
          <Small style={{ textAlign: "center", lineHeight: 21 }}>
            {message ??
              (cancelled
                ? "Your order is saved and waiting. Nothing has been charged."
                : "Please try again in a moment.")}
          </Small>

          <Spacer size={spacing.lg} />
          <View style={styles.orderChip}>
            <Text style={styles.orderChipLabel}>Order</Text>
            <Text style={styles.orderChipValue}>{params.orderNumber}</Text>
            <Text style={styles.orderChipLabel}>{money(amountPaise / 100)}</Text>
          </View>

          <Spacer size={spacing.xxl} />
          <GoldButton
            title="Try payment again"
            onPress={() => {
              setMessage(null);
              setAttempt((n) => n + 1);
              setPhase("paying");
            }}
            icon={<Ionicons name="refresh" size={16} color={colors.ink} />}
          />

          <Spacer size={spacing.md} />
          <OutlineButton
            title="Check this order's status"
            tone="muted"
            onPress={() =>
              router.replace(
                `/order/${encodeURIComponent(params.orderNumber)}?phone=${encodeURIComponent(params.phone ?? "")}`,
              )
            }
          />

          <Spacer size={spacing.md} />
          <OutlineButton
            title="Back to my bag"
            tone="muted"
            onPress={() => router.replace("/bag")}
          />

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
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
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
