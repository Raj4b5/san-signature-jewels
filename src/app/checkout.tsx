import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Container,
  Divider,
  ErrorNote,
  Field,
  GoldButton,
  Loader,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import {
  INDIAN_STATES,
  isValidEmail,
  isValidPhone,
  isValidPincode,
  money,
  normalisePhone,
} from "@/lib/format";
import { fetchSettings, placeOrder } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cartSavings, cartSubtotal, useCart } from "@/store/cart";
import { useCheckout } from "@/store/checkout";

type Errors = Partial<Record<keyof ReturnType<typeof useCheckout.getState>["customer"], string>>;

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ label: s, value: s }));

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const customer = useCheckout((s) => s.customer);
  const update = useCheckout((s) => s.update);

  const settings = useAsync(fetchSettings, []);
  const [method, setMethod] = useState<"razorpay" | "cod">("razorpay");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (settings.loading) return <Loader />;

  const data = settings.data!;
  const subtotal = cartSubtotal(lines);
  const savings = cartSavings(lines);
  const deliveryCharge =
    data.free_delivery_above > 0 && subtotal >= data.free_delivery_above
      ? 0
      : Number(data.delivery_charge ?? 0);
  const total = subtotal + deliveryCharge;

  // Neither method can be forced on: the owner can switch either off.
  const methods: ("razorpay" | "cod")[] = [
    ...(data.online_payment_enabled ? (["razorpay"] as const) : []),
    ...(data.cod_enabled ? (["cod"] as const) : []),
  ];
  const activeMethod = methods.includes(method) ? method : methods[0];

  if (lines.length === 0) {
    return (
      <Screen>
        <Header onBack={() => router.back()} top={insets.top} title="Checkout" />
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <ErrorNote message="Your bag is empty." />
          <Spacer size={spacing.lg} />
          <GoldButton title="Browse the collection" onPress={() => router.replace("/shop")} />
        </View>
      </Screen>
    );
  }

  function validate(): boolean {
    const next: Errors = {};

    if (customer.name.trim().length < 2) next.name = "Please enter your full name.";
    if (!isValidPhone(customer.phone)) next.phone = "Enter a valid 10-digit mobile number.";
    if (!isValidEmail(customer.email)) next.email = "That email address looks incorrect.";
    if (customer.address_line1.trim().length < 5) {
      next.address_line1 = "Enter your house / flat number and street.";
    }
    if (customer.city.trim().length < 2) next.city = "Enter your city.";
    if (!customer.state) next.state = "Select your state.";
    if (!isValidPincode(customer.pincode)) next.pincode = "Enter a valid 6-digit PIN code.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setSubmitError(null);
    if (!validate()) {
      setSubmitError("Please correct the highlighted fields.");
      return;
    }
    if (!activeMethod) {
      setSubmitError("Ordering is paused right now. Please contact us on WhatsApp.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await placeOrder(
        lines,
        { ...customer, phone: normalisePhone(customer.phone) },
        activeMethod,
      );

      if (result.payment_method === "cod") {
        // Confirmed the moment it is placed.
        clearCart();
        router.replace(
          `/order/${encodeURIComponent(result.order_number)}?phone=${normalisePhone(customer.phone)}&placed=1`,
        );
        return;
      }

      // The bag is NOT cleared here -- if the payment is abandoned the
      // customer should come back to a full bag, not an empty one.
      router.push({
        pathname: "/pay",
        params: {
          orderNumber: result.order_number,
          rzpOrderId: result.razorpay!.order_id,
          keyId: result.razorpay!.key_id,
          amount: String(result.razorpay!.amount),
          name: result.razorpay!.prefill.name,
          contact: result.razorpay!.prefill.contact,
          email: result.razorpay!.prefill.email,
          phone: normalisePhone(customer.phone),
          // The pieces are held from this moment. The payment screen uses
          // the device's own clock from here on, so clock skew between the
          // phone and the server cannot shorten or stretch the hold.
          holdSeconds: String(result.hold_seconds ?? 0),
          placedAt: String(Date.now()),
        },
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Header onBack={() => router.back()} top={insets.top} title="Checkout" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Container width={720} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            {/* ------------------------------------------- Delivery */}
            <SectionTitle style={{ fontSize: 20 }}>Delivery details</SectionTitle>
            <Spacer size={spacing.lg} />

            <View style={{ gap: spacing.md }}>
              <Field
                label="Full name"
                required
                value={customer.name}
                onChangeText={(v) => update({ name: v })}
                error={errors.name}
                placeholder="Your name"
                autoCapitalize="words"
                textContentType="name"
              />
              <Field
                label="Mobile number"
                required
                value={customer.phone}
                onChangeText={(v) => update({ phone: v })}
                error={errors.phone}
                placeholder="10-digit mobile"
                keyboardType="number-pad"
                maxLength={13}
                textContentType="telephoneNumber"
                hint="We will send order updates to this number."
              />
              <Field
                label="Email (optional)"
                value={customer.email}
                onChangeText={(v) => update({ email: v })}
                error={errors.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
              <Field
                label="Flat / House no., Building, Street"
                required
                value={customer.address_line1}
                onChangeText={(v) => update({ address_line1: v })}
                error={errors.address_line1}
                placeholder="Flat 302, Sai Residency, Main Road"
                multiline
              />
              <Field
                label="Area, Landmark (optional)"
                value={customer.address_line2}
                onChangeText={(v) => update({ address_line2: v })}
                placeholder="Near Puppalguda junction"
              />

              <Row gap={spacing.md} align="flex-start">
                <Field
                  label="City"
                  required
                  containerStyle={{ flex: 1 }}
                  value={customer.city}
                  onChangeText={(v) => update({ city: v })}
                  error={errors.city}
                  placeholder="Hyderabad"
                />
                <Field
                  label="PIN code"
                  required
                  containerStyle={{ flex: 1 }}
                  value={customer.pincode}
                  onChangeText={(v) => update({ pincode: v.replace(/\D/g, "") })}
                  error={errors.pincode}
                  placeholder="500089"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </Row>

              <SelectField
                label="State"
                required
                value={customer.state || null}
                options={STATE_OPTIONS}
                onChange={(v) => update({ state: v ?? "" })}
                error={errors.state}
                placeholder="Select your state"
              />

              <Field
                label="Note for us (optional)"
                value={customer.notes}
                onChangeText={(v) => update({ notes: v })}
                placeholder="Gift wrap, delivery timing, anything else"
                multiline
              />
            </View>

            {/* -------------------------------------------- Payment */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 20 }}>Payment</SectionTitle>
            <Spacer size={spacing.lg} />

            {methods.length === 0 ? (
              <ErrorNote message="Ordering is paused right now. Please reach us on WhatsApp." />
            ) : (
              <View style={{ gap: spacing.md }}>
                {methods.includes("razorpay") && (
                  <PaymentOption
                    icon="card-outline"
                    title="Pay online"
                    subtitle="UPI, cards, net banking and wallets via Razorpay"
                    selected={activeMethod === "razorpay"}
                    onPress={() => setMethod("razorpay")}
                  />
                )}
                {methods.includes("cod") && (
                  <PaymentOption
                    icon="cash-outline"
                    title="Cash on delivery"
                    subtitle="Pay when the piece reaches you"
                    selected={activeMethod === "cod"}
                    onPress={() => setMethod("cod")}
                  />
                )}
              </View>
            )}

            {/* -------------------------------------------- Summary */}
            <Spacer size={spacing.xxl} />
            <View style={styles.summary}>
              <SectionTitle style={{ fontSize: 18 }}>Order summary</SectionTitle>
              <Spacer size={spacing.md} />

              {lines.map((line) => (
                <Row key={line.productId} justify="space-between" style={{ paddingVertical: 4 }}>
                  <Text style={styles.summaryItem} numberOfLines={1}>
                    {line.name}
                    {line.quantity > 1 ? `  x${line.quantity}` : ""}
                  </Text>
                  <Text style={styles.summaryItemValue}>{money(line.price * line.quantity)}</Text>
                </Row>
              ))}

              <Divider style={{ marginVertical: spacing.md }} />
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

            {!!submitError && (
              <>
                <Spacer size={spacing.lg} />
                <ErrorNote message={submitError} />
              </>
            )}

            <Spacer size={spacing.xl} />
            <GoldButton
              title={activeMethod === "cod" ? `Place order - ${money(total)}` : `Pay ${money(total)}`}
              onPress={submit}
              loading={submitting}
              disabled={methods.length === 0}
              icon={
                <Ionicons
                  name={activeMethod === "cod" ? "checkmark-circle" : "shield-checkmark-outline"}
                  size={16}
                  color={colors.ink}
                />
              }
            />

            <Spacer size={spacing.md} />
            <Small style={{ textAlign: "center", fontSize: 11.5 }}>
              By placing this order you agree to our terms, shipping and returns policy.
            </Small>
          </Container>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Header({ onBack, top, title }: { onBack: () => void; top: number; title: string }) {
  return (
    <View style={[styles.header, { paddingTop: top + spacing.sm }]}>
      <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
        <Row gap={spacing.md}>
          <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
        </Row>
      </Container>
    </View>
  );
}

function PaymentOption({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.paymentOption,
        selected && { borderColor: colors.gold, backgroundColor: "rgba(212,175,55,0.07)" },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.radio, selected && { borderColor: colors.gold }]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Ionicons name={icon} size={19} color={selected ? colors.gold : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.paymentTitle, selected && { color: colors.goldLight }]}>{title}</Text>
        <Small style={{ fontSize: 12, marginTop: 1 }}>{subtitle}</Small>
      </View>
    </Pressable>
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

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.goldLight },

  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  paymentTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.cream },

  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryItem: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, flex: 1, marginRight: spacing.md },
  summaryItemValue: { fontFamily: fonts.body, fontSize: 13, color: colors.cream },
  summaryLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  summaryLabelStrong: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 15 },
  summaryValue: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  summaryValueStrong: { fontFamily: fonts.bodySemi, fontSize: 19, color: colors.goldLight },
});
