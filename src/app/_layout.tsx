import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from "@expo-google-fonts/jost";

import { colors } from "@/theme";
import { useAuth } from "@/store/auth";
import { isConfigured } from "@/lib/supabase";
import { SetupRequired } from "@/components/SetupRequired";
import { DemoBadge } from "@/components/DemoBadge";
import { isDemo } from "@/demo/mode";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });

  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    // Nothing to restore, and the placeholder client would only 401.
    if (!isConfigured) return;
    return bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // A missing font should never leave the user on a splash screen
    // forever -- render with the system fallback instead.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  }

  if (!isConfigured) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <SetupRequired />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ink },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(shop)" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="pay" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="order/[orderNumber]" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="+not-found" />
        </Stack>
        {isDemo && <DemoBadge />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
