import React, { useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, radius, spacing } from "@/theme";
import {
  Badge,
  Container,
  Divider,
  EmptyState,
  ErrorNote,
  Loader,
  Row,
  Screen,
  Small,
  Spacer,
} from "@/components/ui";
import { adminFetchOrders, resolveStockConflict, updateOrderStatus } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/useAsync";
import {
  formatDateTime,
  money,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/format";
import type { Order } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "placed", label: "New" },
  { key: "conflict", label: "Stock conflict" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

/** What the owner can move an order to next. */
const NEXT_STATUS: Record<string, { key: string; label: string }[]> = {
  placed: [
    { key: "confirmed", label: "Confirm" },
    { key: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { key: "packed", label: "Mark packed" },
    { key: "cancelled", label: "Cancel" },
  ],
  packed: [
    { key: "shipped", label: "Mark shipped" },
    { key: "cancelled", label: "Cancel" },
  ],
  shipped: [{ key: "delivered", label: "Mark delivered" }],
  delivered: [],
  cancelled: [],
};

export default function AdminOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string; focus?: string }>();

  const [status, setStatus] = useState<string>(
    FILTERS.some((f) => f.key === params.status) ? params.status! : "all",
  );
  const [search, setSearch] = useState(params.focus ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const state = useAsync(
    () => adminFetchOrders({ status, search: debouncedSearch, limit: 100 }),
    [status, debouncedSearch],
  );

  async function resolveConflict(order: Order) {
    setBusyId(order.id);
    try {
      await resolveStockConflict(order.id);
      state.setData(
        (state.data ?? [])
          .map((o) => (o.id === order.id ? { ...o, stock_conflict: false } : o))
          // On the conflict filter, a resolved order no longer belongs.
          .filter((o) => status !== "conflict" || o.stock_conflict),
      );
    } catch {
      state.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(order: Order, next: string) {
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, next);
      state.setData(
        (state.data ?? []).map((o) => (o.id === order.id ? { ...o, status: next as any } : o)),
      );
    } catch {
      state.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const rows = state.data ?? [];

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Container style={{ paddingHorizontal: spacing.lg }}>
          <Row gap={spacing.md}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={colors.cream} />
            </Pressable>
            <Text style={styles.headerTitle}>Orders</Text>
          </Row>

          <Spacer size={spacing.md} />
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Order number, name or mobile"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
          >
            {FILTERS.map((filter) => (
              <Pressable
                key={filter.key}
                onPress={() => setStatus(filter.key)}
                style={({ pressed }) => [
                  styles.chip,
                  status === filter.key && { backgroundColor: colors.gold, borderColor: colors.gold },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.chipText, status === filter.key && { color: colors.ink }]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Container>
      </View>

      {state.loading ? (
        <Loader />
      ) : state.error ? (
        <View style={{ padding: spacing.xl }}>
          <ErrorNote message={state.error} onRetry={state.reload} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            search ? "Nothing matches" : status === "conflict" ? "No stock conflicts" : "No orders here yet"
          }
          message={
            search
              ? "Try the full order number, or the customer's mobile."
              : status === "conflict"
                ? "Nothing needs sorting out. A paid order for a piece that had already sold would show up here."
                : "Orders will appear the moment a customer checks out."
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.sm,
            alignSelf: "center",
            width: "100%",
            maxWidth: 1180,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={state.refresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={colors.surface}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              expanded={expanded === item.id}
              busy={busyId === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              onStatus={(next) => changeStatus(item, next)}
              onResolveConflict={() => resolveConflict(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

function OrderCard({
  order,
  expanded,
  busy,
  onToggle,
  onStatus,
  onResolveConflict,
}: {
  order: Order;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onStatus: (next: string) => void;
  onResolveConflict: () => void;
}) {
  const actions = NEXT_STATUS[order.status] ?? [];
  const unpaid = order.payment_status !== "paid" && order.payment_method === "razorpay";

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Small style={{ fontSize: 12, marginTop: 1 }}>
              {order.customer_name} {"·"} {formatDateTime(order.created_at)}
            </Small>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={styles.total}>{money(order.total)}</Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={15}
              color={colors.textFaint}
            />
          </View>
        </Row>

        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }} wrap>
          <Badge
            label={ORDER_STATUS_LABEL[order.status] ?? order.status}
            tone={
              order.status === "cancelled"
                ? "danger"
                : order.status === "delivered"
                  ? "emerald"
                  : order.status === "placed"
                    ? "warning"
                    : "gold"
            }
          />
          <Badge
            label={
              order.payment_method === "cod"
                ? "Cash on delivery"
                : PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status
            }
            tone={order.payment_status === "paid" ? "emerald" : unpaid ? "danger" : "muted"}
          />
          {order.stock_conflict && <Badge label="Stock conflict" tone="danger" />}
          <Small style={{ fontSize: 11 }}>
            {order.order_items?.length ?? 0} item
            {(order.order_items?.length ?? 0) === 1 ? "" : "s"}
          </Small>
        </Row>
      </Pressable>

      {expanded && (
        <>
          {order.stock_conflict && (
            <>
              <Spacer size={spacing.md} />
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  This customer has paid, but a piece in the order had already sold when the
                  payment arrived. Make another piece for them, or refund the payment from your
                  Razorpay dashboard - then mark this resolved.
                </Text>
                <Spacer size={spacing.sm} />
                <Pressable
                  disabled={busy}
                  onPress={onResolveConflict}
                  style={({ pressed }) => [
                    styles.action,
                    { alignSelf: "flex-start", borderColor: colors.danger },
                    (pressed || busy) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>Mark resolved</Text>
                </Pressable>
              </View>
            </>
          )}

          <Divider style={{ marginVertical: spacing.md }} />

          {/* ------------------------------------------------- Items */}
          {(order.order_items ?? []).map((item, index) => (
            <Row key={item.id ?? index} justify="space-between" style={{ paddingVertical: 3 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.product_code} {"·"} {item.product_name}
                {item.quantity > 1 ? `  x${item.quantity}` : ""}
              </Text>
              <Text style={styles.itemValue}>{money(item.line_total)}</Text>
            </Row>
          ))}

          <Divider style={{ marginVertical: spacing.md }} />

          {/* --------------------------------------------- Delivery */}
          <Text style={styles.sectionLabel}>Deliver to</Text>
          <Text style={styles.address}>
            {order.customer_name}
            {"\n"}
            {order.address_line1}
            {order.address_line2 ? `\n${order.address_line2}` : ""}
            {"\n"}
            {order.city}, {order.state} {order.pincode}
          </Text>

          {!!order.notes && (
            <>
              <Spacer size={spacing.md} />
              <Text style={styles.sectionLabel}>Customer note</Text>
              <Text style={styles.address}>{order.notes}</Text>
            </>
          )}

          <Spacer size={spacing.md} />
          <Row gap={spacing.sm} wrap>
            <ContactChip
              icon="call-outline"
              label={order.customer_phone}
              onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
            />
            <ContactChip
              icon="logo-whatsapp"
              label="WhatsApp"
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/91${order.customer_phone}?text=${encodeURIComponent(
                    `Hello ${order.customer_name}, this is San Signature Jewels about your order ${order.order_number}.`,
                  )}`,
                )
              }
            />
          </Row>

          {/* ---------------------------------------------- Actions */}
          {actions.length > 0 && (
            <>
              <Divider style={{ marginVertical: spacing.md }} />
              <Row gap={spacing.sm} wrap>
                {actions.map((action) => (
                  <Pressable
                    key={action.key}
                    disabled={busy}
                    onPress={() => onStatus(action.key)}
                    style={({ pressed }) => [
                      styles.action,
                      action.key === "cancelled" && { borderColor: colors.danger },
                      (pressed || busy) && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        action.key === "cancelled" && { color: colors.danger },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </Row>
            </>
          )}

          {unpaid && (
            <>
              <Spacer size={spacing.md} />
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  Online payment has not been confirmed for this order. Do not ship until the
                  status shows Paid.
                </Text>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

function ContactChip({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.contactChip, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={14} color={colors.gold} />
      <Text style={styles.contactChipText}>{label}</Text>
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
  headerTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.goldLight },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  orderNumber: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.cream, letterSpacing: 0.4 },
  total: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.goldLight },

  itemName: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, flex: 1, marginRight: spacing.md },
  itemValue: { fontFamily: fonts.body, fontSize: 12.5, color: colors.cream },

  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  address: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.cream },

  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm - 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  contactChipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.cream },

  action: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm - 1,
  },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.gold },

  warning: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(224,97,78,0.09)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.danger },
});
