import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts } from "@/theme";
import { useCart, cartCount } from "@/store/cart";

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

export default function ShopTabsLayout() {
  const count = useCart((s) => cartCount(s.lines));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surfaceSunken,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 10.5,
          letterSpacing: 0.8,
          // React Navigation lays the tab item out as a flex column, and
          // on web the label is shrinkable -- it gets squeezed to ~7px
          // and the glyphs are cropped. Pin the line box instead.
          lineHeight: 15,
          marginTop: 2,
          flexShrink: 0,
        },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Collection",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "diamond" : "diamond-outline"} size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bag"
        options={{
          title: "Bag",
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="bag-handle-outline" size={21} color={color} />
              <TabBadge count={count} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={21} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    lineHeight: 13,
    color: colors.ink,
  },
});
