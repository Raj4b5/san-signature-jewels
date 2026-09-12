import React from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Container,
  ErrorNote,
  GoldButton,
  Loader,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  TextButton,
} from "@/components/ui";
import { BrandBar } from "@/components/Brand";
import { adminFetchOrders, fetchDashboardStats } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { money, relativeDay, ORDER_STATUS_LABEL } from "@/lib/format";
import { useAuth } from "@/store/auth";

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signOut = useAuth((s) => s.signOut);

  const state = useAsync(async () => {
    const [stats, recentOrders] = await Promise.all([
      fetchDashboardStats(),
      adminFetchOrders({ limit: 5 }),
    ]);
    return { stats, recentOrders };
  }, []);

  // Coming back from adding a piece should show the new count, not a
  // stale one.
  useFocusEffect(
    React.useCallback(() => {
      state.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (state.loading) return <Loader />;

  if (state.error && !state.data) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <ErrorNote message={state.error} onRetry={state.reload} />
        </View>
      </Screen>
    );
  }

  const { stats, recentOrders } = state.data!;

  return (
    <Screen
      scroll
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Row justify="space-between">
            <BrandBar />
            <Pressable onPress={signOut} hitSlop={8} accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={21} color={colors.textMuted} />
            </Pressable>
          </Row>
        </Container>
      </View>

      <Container style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        {/* --------------------------------------- Primary daily action */}
        <GoldButton
          title="Add a new piece"
          onPress={() => router.push("/admin/product/new")}
          icon={<Ionicons name="add-circle-outline" size={17} color={colors.ink} />}
          size="lg"
        />

        {stats.orders_new > 0 && (
          <>
            <Spacer size={spacing.md} />
            <Pressable
              onPress={() => router.push("/admin/orders?status=placed")}
              style={({ pressed }) => [styles.alert, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.ink} />
              <Text style={styles.alertText}>
                {stats.orders_new === 1
                  ? "1 new order needs confirming"
                  : `${stats.orders_new} new orders need confirming`}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.ink} />
            </Pressable>
          </>
        )}

        {/* ------------------------------------------------------ Stats */}
        <Spacer size={spacing.xl} />
        <Row gap={spacing.md} wrap>
          <StatTile
            label="Live pieces"
            value={String(stats.products_live)}
            sub={`${stats.products_total} total`}
            icon="diamond-outline"
            onPress={() => router.push("/admin/products?status=live")}
          />
          <StatTile
            label="Sold out"
            value={String(stats.out_of_stock)}
            sub="Needs restocking"
            icon="warning-outline"
            tone={stats.out_of_stock > 0 ? "warning" : undefined}
            onPress={() => router.push("/admin/products?status=sold_out")}
          />
          <StatTile
            label="Orders today"
            value={String(stats.orders_today)}
            sub={`${stats.orders_total} all time`}
            icon="receipt-outline"
            onPress={() => router.push("/admin/orders")}
          />
          <StatTile
            label="This month"
            value={money(stats.revenue_month)}
            sub={`${money(stats.revenue_paid)} all time`}
            icon="wallet-outline"
            tone="emerald"
          />
        </Row>

        {/* ----------------------------------------------- Quick links */}
        <Spacer size={spacing.xl} />
        <View style={styles.card}>
          <AdminLink
            icon="list-outline"
            title="Manage pieces"
            subtitle="Edit prices, discounts, stock and photos"
            onPress={() => router.push("/admin/products")}
          />
          <AdminLink
            icon="receipt-outline"
            title="Orders"
            subtitle="Confirm, pack and mark delivered"
            onPress={() => router.push("/admin/orders")}
          />
          <AdminLink
            icon="pricetag-outline"
            title="Run a sale"
            subtitle="Apply a discount across many pieces at once"
            onPress={() => router.push("/admin/products?bulk=1")}
          />
          <AdminLink
            icon="settings-outline"
            title="Store settings"
            subtitle="Delivery charges, payment methods, banner"
            onPress={() => router.push("/admin/settings")}
            last
          />
        </View>

        {/* -------------------------------------------- Recent orders */}
        {recentOrders.length > 0 && (
          <>
            <Spacer size={spacing.xl} />
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
              <SectionTitle style={{ fontSize: 19 }}>Latest orders</SectionTitle>
              <TextButton title="See all" onPress={() => router.push("/admin/orders")} />
            </Row>

            <View style={{ gap: spacing.sm }}>
              {recentOrders.map((order) => (
                <Pressable
                  key={order.id}
                  onPress={() => router.push(`/admin/orders?focus=${order.order_number}`)}
                  style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.8 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>{order.order_number}</Text>
                    <Small style={{ fontSize: 12 }}>
                      {order.customer_name} {"·"} {relativeDay(order.created_at)}
                    </Small>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.orderTotal}>{money(order.total)}</Text>
                    <Small style={{ fontSize: 11 }}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Small>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Spacer size={spacing.xl} />
        <TextButton
          title="View the shop as a customer"
          tone="muted"
          onPress={() => router.push("/")}
          style={{ textAlign: "center" }}
        />
        <Spacer size={spacing.lg} />
      </Container>
    </Screen>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone?: "warning" | "emerald";
  onPress?: () => void;
}) {
  const tint =
    tone === "warning" ? colors.warning : tone === "emerald" ? colors.emeraldLight : colors.gold;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.tile, pressed && onPress && { opacity: 0.8 }]}
    >
      <Row justify="space-between">
        <Text style={styles.tileLabel}>{label}</Text>
        <Ionicons name={icon} size={15} color={tint} />
      </Row>
      <Text style={[styles.tileValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!sub && <Small style={{ fontSize: 11 }}>{sub}</Small>}
    </Pressable>
  );
}

function AdminLink({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.adminLink,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.adminLinkIcon}>
        <Ionicons name={icon} size={16} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.adminLinkTitle}>{title}</Text>
        <Small style={{ fontSize: 12, marginTop: 1 }}>{subtitle}</Small>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },

  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  alertText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },

  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 150,
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  tileLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  tileValue: { fontFamily: fonts.bodySemi, fontSize: 24, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  adminLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  adminLinkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  adminLinkTitle: { fontFamily: fonts.body, fontSize: 14.5, color: colors.cream },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  orderNumber: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.cream },
  orderTotal: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.goldLight },
});
