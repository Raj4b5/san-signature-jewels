import React from "react";
import { Redirect, Stack, usePathname } from "expo-router";
import { colors } from "@/theme";
import { Loader } from "@/components/ui";
import { useAuth } from "@/store/auth";

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const pathname = usePathname();

  const onLoginScreen = pathname === "/admin/login";

  // Wait for the stored session before deciding, otherwise a signed-in
  // owner is bounced to the login screen on every cold start.
  if (loading) return <Loader />;

  if (!isAdmin && !onLoginScreen) return <Redirect href="/admin/login" />;
  if (isAdmin && onLoginScreen) return <Redirect href="/admin" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        animation: "slide_from_right",
      }}
    />
  );
}
