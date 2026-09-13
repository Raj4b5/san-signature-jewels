import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/theme";

/**
 * A small, always-visible "DEMO" marker. The demo build uses the real shop
 * name and contact details, so a screenshot or a shared link must never be
 * mistaken for the live store. It ignores touches so nothing underneath is
 * blocked.
 */
export function DemoBadge() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { top: insets.top + 4, pointerEvents: "none" }]}>
      <View style={styles.pill}>
        <Text style={styles.text}>DEMO {"·"} SAMPLE DATA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  pill: {
    backgroundColor: colors.emerald,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.emeraldLight,
  },
  text: {
    fontFamily: fonts.bodySemi,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.goldPale,
  },
});
