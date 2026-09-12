import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts, radius, spacing, type } from "@/theme";

/**
 * A searchable picker. Used for the state list at checkout and the
 * category list in the admin editor -- both long enough that a native
 * wheel or a raw list would be painful on a phone.
 */
export function SelectField<T extends { label: string; value: string }>({
  label,
  placeholder = "Select",
  value,
  options,
  onChange,
  required,
  error,
  searchable = true,
  allowClear = false,
}: {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: T[];
  onChange: (value: string | null) => void;
  required?: boolean;
  error?: string | null;
  searchable?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <View style={{ gap: spacing.xs }}>
      {!!label && (
        <Text style={type.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      )}

      <Pressable
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.trigger,
          !!error && { borderColor: colors.danger },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[styles.triggerText, !selected && { color: colors.textFaint }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label ?? "Select"}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {searchable && (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
                autoCorrect={false}
              />
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowClear ? (
                <Pressable
                  onPress={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.optionText, { color: colors.textMuted }]}>
                    {placeholder}
                  </Text>
                  {value === null && <Ionicons name="checkmark" size={17} color={colors.gold} />}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.empty}>Nothing matches "{query}"</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
              >
                <Text
                  style={[
                    styles.optionText,
                    item.value === value && { color: colors.goldLight },
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === value && (
                  <Ionicons name="checkmark" size={17} color={colors.gold} />
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  triggerText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, flex: 1 },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger },

  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.goldLight },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textFaint,
    textAlign: "center",
    padding: spacing.xxl,
  },
});
