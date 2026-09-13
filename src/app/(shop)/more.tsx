import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  GoldRule,
  Loader,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
} from "@/components/ui";
import { Monogram, Wordmark } from "@/components/Brand";
import { fetchSettings, lookupOrder } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { callShop, openInstagram, openMaps, openWhatsApp } from "@/lib/contact";
import { isValidPhone } from "@/lib/format";
import { useAuth } from "@/store/auth";

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useAsync(fetchSettings, []);
  const isAdmin = useAuth((s) => s.isAdmin);

  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  async function trackOrder() {
    setTrackError(null);

    if (!orderNumber.trim()) {
      setTrackError("Enter the order number from your confirmation.");
      return;
    }
    if (!isValidPhone(phone)) {
      setTrackError("Enter the 10-digit mobile number used to order.");
      return;
    }

    setTracking(true);
    try {
      const order = await lookupOrder(orderNumber, phone);
      if (!order) {
        setTrackError("No order found with that number and mobile.");
        return;
      }
      router.push(
        `/order/${encodeURIComponent(order.order_number)}?phone=${encodeURIComponent(phone)}`,
      );
    } catch {
      setTrackError("Could not reach the store. Please check your connection.");
    } finally {
      setTracking(false);
    }
  }

  if (settings.loading) return <Loader />;

  const data = settings.data;

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxxl }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <Monogram size={48} />
        <Spacer size={spacing.md} />
        <Wordmark size="sm" tagline={data?.tagline} />
      </View>

      <Container style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        {/* ------------------------------------------------ Track order */}
        <View style={styles.card}>
          <Row gap={spacing.sm}>
            <Ionicons name="cube-outline" size={18} color={colors.gold} />
            <SectionTitle style={{ fontSize: 20 }}>Track your order</SectionTitle>
          </Row>
          <Small style={{ marginTop: spacing.xs }}>
            Enter the order number we sent you and the mobile number you ordered with.
          </Small>

          <Spacer size={spacing.lg} />
          <Field
            label="Order number"
            value={orderNumber}
            onChangeText={setOrderNumber}
            placeholder="SJ-2026-1001"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Spacer size={spacing.md} />
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile"
            keyboardType="number-pad"
            maxLength={13}
          />

          {!!trackError && (
            <>
              <Spacer size={spacing.md} />
              <ErrorNote message={trackError} />
            </>
          )}

          <Spacer size={spacing.lg} />
          <GoldButton title="Find my order" onPress={trackOrder} loading={tracking} />
        </View>

        {/* --------------------------------------------------- Contact */}
        <Spacer size={spacing.xl} />
        <View style={styles.card}>
          <SectionTitle style={{ fontSize: 20 }}>Get in touch</SectionTitle>
          <Spacer size={spacing.lg} />

          <LinkRow
            icon="logo-whatsapp"
            title="Chat on WhatsApp"
            subtitle={data?.whatsapp_number?.replace(/^91/, "") ?? ""}
            onPress={() =>
              openWhatsApp(
                data,
                "Hello San Signature Jewels, I would like to know more about your collection.",
              )
            }
          />
          <Divider />
          <LinkRow
            icon="call-outline"
            title="Call the shop"
            subtitle={data?.phone_primary ?? ""}
            onPress={() => callShop(data, "primary")}
          />
          {!!data?.phone_secondary && (
            <>
              <Divider />
              <LinkRow
                icon="call-outline"
                title="Alternate number"
                subtitle={data.phone_secondary}
                onPress={() => callShop(data, "secondary")}
              />
            </>
          )}
          <Divider />
          <LinkRow
            icon="location-outline"
            title="Visit the studio"
            subtitle={data?.address ?? ""}
            onPress={() => openMaps(data)}
          />
          {!!data?.instagram_url && (
            <>
              <Divider />
              <LinkRow
                icon="logo-instagram"
                title="Follow on Instagram"
                subtitle="See the newest pieces first"
                onPress={() => openInstagram(data)}
              />
            </>
          )}
        </View>

        {/* ----------------------------------------------------- About */}
        <Spacer size={spacing.xl} />
        <View style={styles.card}>
          <SectionTitle style={{ fontSize: 20 }}>About San Signature Jewels</SectionTitle>
          <Spacer size={spacing.md} />
          <Text style={styles.about}>
            Every piece here is handmade in small numbers, designed to be worn and remembered.
            From bridal sets and temple jewellery to everyday earrings, we blend traditional
            craft with a modern eye.
          </Text>
          <Spacer size={spacing.md} />
          <Text style={styles.about}>
            Because each design is made by hand, no two are exactly alike, and most are made in
            very limited quantities.
          </Text>

          <Spacer size={spacing.lg} />
          <GoldRule />
          <Spacer size={spacing.md} />
          <Text style={styles.script}>Thank you for supporting handmade & local</Text>
        </View>

        {/* --------------------------------------------------- Policies */}
        <Spacer size={spacing.xl} />
        <View style={styles.card}>
          <SectionTitle style={{ fontSize: 20 }}>Policies</SectionTitle>
          <Spacer size={spacing.md} />
          <LinkRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            subtitle="How we handle your details"
            onPress={() => router.push("/policy/privacy")}
          />
          <Divider />
          <LinkRow
            icon="list-outline"
            title="Terms, shipping & returns"
            subtitle="Delivery times and exchanges"
            onPress={() => router.push("/policy/terms")}
          />
        </View>

        {/* ------------------------------------------------ Owner entry */}
        <Spacer size={spacing.xxl} />
        <Pressable
          onPress={() => router.push(isAdmin ? "/admin" : "/admin/login")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.adminLink, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="lock-closed-outline" size={14} color={colors.textFaint} />
          <Text style={styles.adminLinkText}>
            {isAdmin ? "Open store manager" : "Store owner sign in"}
          </Text>
        </Pressable>

        <Spacer size={spacing.xl} />
        <Small style={{ textAlign: "center", fontSize: 11 }}>
          San Signature Jewels {"·"} Hyderabad, Telangana
        </Small>
        <Spacer size={spacing.lg} />
      </Container>
    </Screen>
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.65 }]}
    >
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={16} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        {!!subtitle && (
          <Small style={{ fontSize: 12, marginTop: 1 }} numberOfLines={2}>
            {subtitle}
          </Small>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingBottom: spacing.xl,
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },

  about: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.textMuted },
  script: { fontFamily: fonts.script, fontSize: 17, color: colors.gold, textAlign: "center" },

  adminLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  adminLinkText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textFaint },
});
