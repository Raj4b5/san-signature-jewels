import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, spacing } from "@/theme";
import {
  Container,
  ErrorNote,
  Field,
  GoldButton,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  TextButton,
} from "@/components/ui";
import { Monogram } from "@/components/Brand";
import { useAuth } from "@/store/auth";
import { isDemo } from "@/demo/mode";

export default function AdminLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password);
      router.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.wrap, { paddingTop: insets.top + spacing.xxxl }]}>
          <Container width={420} style={{ paddingHorizontal: spacing.xl }}>
            <View style={{ alignItems: "center" }}>
              <Monogram size={58} />
              <Spacer size={spacing.lg} />
              <SectionTitle style={{ textAlign: "center" }}>Store Manager</SectionTitle>
              <Small style={{ textAlign: "center", marginTop: spacing.xs }}>
                Sign in to add pieces, set prices and see orders.
              </Small>
            </View>

            <Spacer size={spacing.xxl} />

            {isDemo && (
              <>
                <GoldButton
                  title="Enter the demo Store Manager"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      // The demo backend accepts any sign-in; no real
                      // account or password exists.
                      await signIn("owner@demo.local", "demo");
                      router.replace("/admin");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not open the demo.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <Spacer size={spacing.sm} />
                <Small style={{ textAlign: "center", fontSize: 12 }}>
                  Demo only - no password needed. The real app asks for your own login here.
                </Small>
                <Spacer size={spacing.xxl} />
              </>
            )}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
            <Spacer size={spacing.md} />

            <View>
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eye}
                hitSlop={8}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {!!error && (
              <>
                <Spacer size={spacing.lg} />
                <ErrorNote message={error} />
              </>
            )}

            <Spacer size={spacing.xl} />
            <GoldButton title="Sign in" onPress={submit} loading={busy} />

            <Spacer size={spacing.xl} />
            <View style={{ alignItems: "center" }}>
              <TextButton title="Back to the shop" tone="muted" onPress={() => router.replace("/")} />
            </View>

            <Spacer size={spacing.xxl} />
            <Text style={styles.note}>
              Only accounts added to the store's owner list can sign in here.
            </Text>
          </Container>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  eye: { position: "absolute", right: spacing.lg, top: 34 },
  note: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textFaint,
    textAlign: "center",
  },
});
