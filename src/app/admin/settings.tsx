import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  InfoNote,
  Loader,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import { fetchSettings, updateSettings } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { money } from "@/lib/format";
import type { Settings } from "@/lib/types";

type Form = {
  store_name: string;
  tagline: string;
  phone_primary: string;
  phone_secondary: string;
  whatsapp_number: string;
  email: string;
  address: string;
  instagram_url: string;
  delivery_charge: string;
  free_delivery_above: string;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  announcement: string;
  sale_banner_text: string;
  sale_banner_active: boolean;
};

function toForm(settings: Settings): Form {
  return {
    store_name: settings.store_name,
    tagline: settings.tagline,
    phone_primary: settings.phone_primary,
    phone_secondary: settings.phone_secondary ?? "",
    whatsapp_number: settings.whatsapp_number,
    email: settings.email ?? "",
    address: settings.address,
    instagram_url: settings.instagram_url ?? "",
    delivery_charge: String(settings.delivery_charge ?? 0),
    free_delivery_above: String(settings.free_delivery_above ?? 0),
    cod_enabled: settings.cod_enabled,
    online_payment_enabled: settings.online_payment_enabled,
    announcement: settings.announcement ?? "",
    sale_banner_text: settings.sale_banner_text ?? "",
    sale_banner_active: settings.sale_banner_active,
  };
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const state = useAsync(fetchSettings, []);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.data) setForm(toForm(state.data));
  }, [state.data]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!form) return;
    setError(null);

    const deliveryCharge = Number(form.delivery_charge);
    const freeAbove = Number(form.free_delivery_above);

    if (Number.isNaN(deliveryCharge) || deliveryCharge < 0) {
      setError("Delivery charge must be 0 or more.");
      return;
    }
    if (Number.isNaN(freeAbove) || freeAbove < 0) {
      setError("Free delivery threshold must be 0 or more.");
      return;
    }
    if (!form.cod_enabled && !form.online_payment_enabled) {
      setError("At least one payment method must stay on, or nobody can order.");
      return;
    }

    setSaving(true);
    try {
      await updateSettings({
        store_name: form.store_name.trim(),
        tagline: form.tagline.trim(),
        phone_primary: form.phone_primary.replace(/\D/g, ""),
        phone_secondary: form.phone_secondary.replace(/\D/g, "") || null,
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ""),
        email: form.email.trim() || null,
        address: form.address.trim(),
        instagram_url: form.instagram_url.trim() || null,
        delivery_charge: deliveryCharge,
        free_delivery_above: freeAbove,
        cod_enabled: form.cod_enabled,
        online_payment_enabled: form.online_payment_enabled,
        announcement: form.announcement.trim() || null,
        sale_banner_text: form.sale_banner_text.trim() || null,
        sale_banner_active: form.sale_banner_active && !!form.sale_banner_text.trim(),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  }

  if (state.loading || !form) return <Loader />;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
          <Row gap={spacing.md}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={colors.cream} />
            </Pressable>
            <Text style={styles.headerTitle}>Store settings</Text>
          </Row>
        </Container>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Container width={720} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            {/* -------------------------------------------- Delivery */}
            <SectionTitle style={{ fontSize: 19 }}>Delivery</SectionTitle>
            <Spacer size={spacing.md} />

            <Row gap={spacing.md} align="flex-start">
              <Field
                label="Delivery charge"
                containerStyle={{ flex: 1 }}
                value={form.delivery_charge}
                onChangeText={(v) => set("delivery_charge", v.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0"
                hint="0 means always free"
              />
              <Field
                label="Free above"
                containerStyle={{ flex: 1 }}
                value={form.free_delivery_above}
                onChangeText={(v) => set("free_delivery_above", v.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="999"
                hint="Order value for free delivery"
              />
            </Row>

            <Spacer size={spacing.md} />
            <InfoNote
              message={
                Number(form.delivery_charge) === 0
                  ? "Delivery is free on every order."
                  : `${money(Number(form.delivery_charge))} delivery, free once the bag reaches ${money(Number(form.free_delivery_above))}.`
              }
            />

            {/* --------------------------------------------- Payment */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 19 }}>Payment</SectionTitle>
            <Spacer size={spacing.md} />

            <View style={styles.card}>
              <ToggleRow
                label="Accept online payment"
                hint="UPI, cards and net banking via Razorpay"
                value={form.online_payment_enabled}
                onChange={(v) => set("online_payment_enabled", v)}
              />
              <Divider />
              <ToggleRow
                label="Accept cash on delivery"
                hint="Customer pays when the piece arrives"
                value={form.cod_enabled}
                onChange={(v) => set("cod_enabled", v)}
              />
            </View>

            {/* ---------------------------------------------- Banner */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 19 }}>Home page messages</SectionTitle>
            <Spacer size={spacing.md} />

            <Field
              label="Sale banner"
              value={form.sale_banner_text}
              onChangeText={(v) => set("sale_banner_text", v)}
              placeholder="Festive offer - flat 20% off all chokers"
              hint="Shown as a gold strip at the top of the home page"
            />
            <Spacer size={spacing.md} />
            <View style={styles.card}>
              <ToggleRow
                label="Show the sale banner"
                value={form.sale_banner_active}
                onChange={(v) => set("sale_banner_active", v)}
              />
            </View>

            <Spacer size={spacing.md} />
            <Field
              label="Announcement"
              value={form.announcement}
              onChangeText={(v) => set("announcement", v)}
              placeholder="Orders placed after 6 PM ship the next day."
              multiline
              hint="A quieter note below the banner. Leave blank to hide."
            />

            {/* ---------------------------------------------- Contact */}
            <Spacer size={spacing.xxl} />
            <SectionTitle style={{ fontSize: 19 }}>Contact details</SectionTitle>
            <Spacer size={spacing.md} />

            <View style={{ gap: spacing.md }}>
              <Row gap={spacing.md} align="flex-start">
                <Field
                  label="Phone"
                  containerStyle={{ flex: 1 }}
                  value={form.phone_primary}
                  onChangeText={(v) => set("phone_primary", v)}
                  keyboardType="phone-pad"
                />
                <Field
                  label="Alternate phone"
                  containerStyle={{ flex: 1 }}
                  value={form.phone_secondary}
                  onChangeText={(v) => set("phone_secondary", v)}
                  keyboardType="phone-pad"
                />
              </Row>

              <Field
                label="WhatsApp number"
                value={form.whatsapp_number}
                onChangeText={(v) => set("whatsapp_number", v)}
                keyboardType="phone-pad"
                hint="With country code, e.g. 917981492668"
              />
              <Field
                label="Email"
                value={form.email}
                onChangeText={(v) => set("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="orders@example.com"
              />
              <Field
                label="Address"
                value={form.address}
                onChangeText={(v) => set("address", v)}
                multiline
              />
              <Field
                label="Instagram link"
                value={form.instagram_url}
                onChangeText={(v) => set("instagram_url", v)}
                autoCapitalize="none"
                placeholder="https://instagram.com/..."
                hint="Leave blank to hide the Instagram link"
              />
              <Field
                label="Tagline"
                value={form.tagline}
                onChangeText={(v) => set("tagline", v)}
                placeholder="Elegance Crafted for You"
              />
            </View>

            {!!error && (
              <>
                <Spacer size={spacing.lg} />
                <ErrorNote message={error} />
              </>
            )}
            {saved && !error && (
              <>
                <Spacer size={spacing.lg} />
                <InfoNote message="Saved. Customers see the change immediately." tone="emerald" />
              </>
            )}
          </Container>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
          <GoldButton title="Save settings" onPress={save} loading={saving} />
        </Container>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Row justify="space-between" style={{ paddingVertical: spacing.md }}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!hint && <Small style={{ fontSize: 12, marginTop: 1 }}>{hint}</Small>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.goldDeep }}
        thumbColor={value ? colors.goldLight : colors.textFaint}
        ios_backgroundColor={colors.border}
      />
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
  headerTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.goldLight },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14.5, color: colors.cream },

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
});
